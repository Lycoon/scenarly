import DeleteAccountContent from "@components/home/delete-account/DeleteAccountContent";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Delete your account or data | Scenarly®",
    description: "How to delete your Scenarly® account, or only part of your data, and what is kept afterwards.",
};

export default function DeleteAccountPage() {
    return <DeleteAccountContent />;
}
