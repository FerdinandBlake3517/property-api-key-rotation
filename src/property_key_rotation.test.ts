import assert from "node:assert/strict";
import { validatePropertyWorkflow } from "./property_key_rotation.ts";

const request = validatePropertyWorkflow({ propertyId: "flat-12", summary: "Broken extractor", tenantDocumentId: "doc-12", inspectionDue: "2026-12-01" });
assert.equal(request.propertyId, "flat-12");
assert.throws(() => validatePropertyWorkflow({ propertyId: "flat-12", summary: "", tenantDocumentId: "doc-12", inspectionDue: "2026-12-01" }));
console.log("property workflow validation passed");
