-- Coverage no longer asks for a pen name: signed reviews show the username.
ALTER TABLE "CommunityProfile" DROP COLUMN "penName";
