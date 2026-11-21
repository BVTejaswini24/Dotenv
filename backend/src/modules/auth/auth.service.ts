import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../db/pool";
import { ConflictError, UnauthorizedError } from "../../lib/errors";

export const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

export type UserDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: "customer" | "admin";
  created_at: Date;
};

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    ...(row.phone ? { phone: row.phone } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.email("Enter a valid email address").max(255),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s\-+()]{7,20}$/, "Enter a valid phone number")
    .optional(),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").max(255),
  password: z.string().min(1, "Password is required").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export async function registerUser(input: RegisterInput): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();

  const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [
    email,
  ]);
  if ((existing.rowCount ?? 0) > 0) {
    throw new ConflictError(
      "An account with this email already exists",
      "EMAIL_ALREADY_REGISTERED"
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password_hash, first_name, last_name, phone, role, created_at`,
      [email, passwordHash, input.firstName.trim(), input.lastName.trim(), input.phone ?? null]
    );
    return toUserDto(rows[0]);
  } catch (error) {
    // Two concurrent registrations for the same email: the unique index wins.
    if ((error as { code?: string }).code === "23505") {
      throw new ConflictError(
        "An account with this email already exists",
        "EMAIL_ALREADY_REGISTERED"
      );
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();

  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, password_hash, first_name, last_name, phone, role, created_at
       FROM users WHERE email = $1`,
    [email]
  );

  const row = rows[0];
  if (!row) {
    // Constant-ish work so a missing account does not answer faster than a
    // wrong password.
    await bcrypt.compare(
      input.password,
      "$2b$10$0yvmR/N7SRmnWElVSRpZXOrQPNScaz4Y4jcHKRwy/6VD8CPAJDwz."
    );
    throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(input.password, row.password_hash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  return toUserDto(row);
}

export async function getUserById(id: string): Promise<UserDto | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, password_hash, first_name, last_name, phone, role, created_at
       FROM users WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  return row ? toUserDto(row) : null;
}
