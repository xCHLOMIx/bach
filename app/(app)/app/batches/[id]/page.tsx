import { BatchDetailsPage } from "@/components/batch-details-page"

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    return <BatchDetailsPage batchId={id} />
}
