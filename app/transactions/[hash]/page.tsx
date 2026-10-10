import NavBar from "@/components/layout/NavBar";
import TransactionDetail from "@/blocks/transactions/TransactionDetail";

export default async function Page({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  return (
    <div className="flex flex-col gap-4 lg:gap-10 min-h-svh p-6">
      <NavBar />

      <div className="grid gap-2 lg:gap-10">
        <div className="flex gap-2 items-center text-xl">
          <p>Transaction:</p>
          <p className="opacity-60 font-mono text-sm break-all">{hash}</p>
        </div>

        <TransactionDetail hash={hash} />
      </div>
    </div>
  );
}