import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessCreated } from "@src/lib/utils/api-utils";
import { readSubmissionForm } from "@src/lib/community/submission-form";

/**
 * POST `/community/showcase/upload` (multipart/form-data)
 *
 * The `/community/submissions` fields: a Showcase-only submission published in
 * the same transaction, as the kind its format is shown as. No tickets. 201
 * with `{ id, slug }`; 422 on fields or pages; 409 `DUPLICATE_PDF`.
 */
async function upload(req: NextRequest, { user }: AuthApiContext) {
    await TicketService.requireProfile(user.id);
    const { bytes, fields } = await readSubmissionForm(req);
    // `destination` is ignored: this route always makes a Showcase-only submission.
    return SuccessCreated(await ShowcaseService.publishUpload(user.id, bytes, fields));
}

export const POST = apiHandler(upload);
