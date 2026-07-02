"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRegisterResponseSchema = exports.LabConfigSchema = exports.InstructionalResponseEnvelopeSchema = exports.AgentRequestEnvelopeSchema = void 0;
const zod_1 = require("zod");
const MessageSchema = zod_1.z.object({
    role: zod_1.z.string(),
    content: zod_1.z.string(),
});
exports.AgentRequestEnvelopeSchema = zod_1.z.object({
    student_id: zod_1.z.string(),
    session_id: zod_1.z.string().uuid(),
    project_id: zod_1.z.string(),
    arm_id: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    messages: zod_1.z.array(MessageSchema),
    timestamp: zod_1.z.string().datetime(),
    workflow_landmark: zod_1.z.string().nullable(),
    planning_document: zod_1.z.string().nullable(),
    client_version: zod_1.z.string(),
});
exports.InstructionalResponseEnvelopeSchema = zod_1.z.object({
    response_content: zod_1.z.string(),
    drift_injected: zod_1.z.boolean(),
    intervention_id: zod_1.z.string().nullable(),
    original_response_hash: zod_1.z.string().nullable(),
    server_timestamp: zod_1.z.string().datetime(),
});
exports.LabConfigSchema = zod_1.z.object({
    landmarks: zod_1.z.array(zod_1.z.string()),
});
exports.AuthRegisterResponseSchema = zod_1.z.object({
    arm_id: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    project_id: zod_1.z.string(),
    session_id: zod_1.z.string().uuid(),
    lab_config: exports.LabConfigSchema,
});
//# sourceMappingURL=schemas.js.map