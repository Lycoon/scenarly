-- Whether a project has a poster is answered by R2 itself (`poster-{projectId}`):
-- the flag drifted false on older builds and then hid posters that existed.
ALTER TABLE "Project" DROP COLUMN "hasPoster";
