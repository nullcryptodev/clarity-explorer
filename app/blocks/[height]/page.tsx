import Overview from "@/blocks/blocks/Overview"
import BlockTransactions from "@/blocks/blocks/BlockTransactions"
import NavBar from "@/components/layout/NavBar"

export default async function Page({
  params,
}: {
  params: Promise<{ height: string }>
}) {
  const { height } = await params

  return (
    <div className="flex flex-col gap-4 lg:gap-10 min-h-svh p-6">
      <NavBar />

      <div className="grid gap-2 lg:gap-10">
        <div className="flex gap-2 items-center text-xl">
          <p>Block:</p>
          <p className="opacity-60">{height}</p>
        </div>

        <Overview height={height} />

        <BlockTransactions height={height} />
      </div>
    </div>
  )
}