import z from "zod";
import { PERIODS, PLANS } from "@src/lib/plans";
import type { UserLanguage } from "@src/lib/utils/types";

const SignInEmailSchema = z.email().transform((email) => email.toLowerCase().trim());

export const SIGN_IN_CODE_PATTERN = /^\d{6}$/;

/** Why a sign-in code request or check failed, for the sign-in form to translate. */
export const SignInCodeError = {
    THROTTLED: "SIGN_IN_THROTTLED",
    INVALID: "SIGN_IN_CODE_INVALID",
    EXPIRED: "SIGN_IN_CODE_EXPIRED",
    LOCKED: "SIGN_IN_LOCKED",
    NOT_ALLOWED: "SIGN_IN_NOT_ALLOWED",
} as const;

export const RequestSignInCodeBodySchema = z.object({
    email: SignInEmailSchema,
    inviteToken: z.string().optional(),
});
export type RequestSignInCodeBody = z.input<typeof RequestSignInCodeBodySchema>;

export const VerifySignInCodeBodySchema = z.object({
    email: SignInEmailSchema,
    code: z.string().regex(SIGN_IN_CODE_PATTERN),
    // The desktop and mobile apps take the session as a bearer token, not a cookie.
    desktop: z.boolean().optional(),
});
export type VerifySignInCodeBody = z.input<typeof VerifySignInCodeBodySchema>;

export const CreateProjectBodySchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;

export const UpdateProjectBodySchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    characters: z.any().optional(),
});
export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>;

export const UpdateRoleSchema = z.object({
    role: z.string(),
});
export type UpdateRoleBody = z.infer<typeof UpdateRoleSchema>;

export const TransferOwnershipSchema = z.object({
    userId: z.string().min(1),
});
export type TransferOwnershipBody = z.infer<typeof TransferOwnershipSchema>;

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
export const UpdateUserBodySchema = z.object({
    username: z.string().optional(),
    color: z.string().regex(HEX_COLOR_REGEX).optional(),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;

export const PlanBodySchema = z.object({
    plan: z.enum(PLANS),
});
export type PlanBody = z.infer<typeof PlanBodySchema>;

export const GrantPlanBodySchema = PlanBodySchema.extend({
    expiresAt: z.coerce.date().refine((date) => date > new Date(), "Must be in the future"),
});
export type GrantPlanBody = z.infer<typeof GrantPlanBodySchema>;

const UI_LANGUAGES = ["en", "es", "fr", "zh", "ko", "ja", "de", "pl"] as const satisfies readonly UserLanguage[];

export const CheckoutBodySchema = PlanBodySchema.extend({
    period: z.enum(PERIODS),
    redirectBase: z.string().optional(),
    // Language of the consent line shown on the Stripe page.
    language: z.enum(UI_LANGUAGES).optional(),
});
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;

export const WithdrawBodySchema = PlanBodySchema.extend({
    // Formats the refunded amount the settings show back.
    locale: z.string().trim().min(2).max(10).optional(),
});
export type WithdrawBody = z.infer<typeof WithdrawBodySchema>;
