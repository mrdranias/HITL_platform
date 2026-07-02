import { z } from "zod";

const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export const AgentRequestEnvelopeSchema = z.object({
  student_id: z.string(),
  session_id: z.string().uuid(),
  project_id: z.string(),
  arm_id: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  messages: z.array(MessageSchema),
  timestamp: z.string().datetime(),
  workflow_landmark: z.string().nullable(),
  planning_document: z.string().nullable(),
  client_version: z.string(),
});

export type AgentRequestEnvelope = z.infer<typeof AgentRequestEnvelopeSchema>;

export const InstructionalResponseEnvelopeSchema = z.object({
  response_content: z.string(),
  drift_injected: z.boolean(),
  intervention_id: z.string().nullable(),
  original_response_hash: z.string().nullable(),
  server_timestamp: z.string().datetime(),
});

export type InstructionalResponseEnvelope = z.infer<
  typeof InstructionalResponseEnvelopeSchema
>;

export const LabConfigSchema = z.object({
  landmarks: z.array(z.string()),
});

export type LabConfig = z.infer<typeof LabConfigSchema>;

export const AuthRegisterResponseSchema = z.object({
  arm_id: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  project_id: z.string(),
  session_id: z.string().uuid(),
  lab_config: LabConfigSchema,
});

export type AuthRegisterResponse = z.infer<
  typeof AuthRegisterResponseSchema
>;
