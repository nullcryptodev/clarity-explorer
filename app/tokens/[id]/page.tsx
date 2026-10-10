import TokenDetail from "@/blocks/tokens/TokenDetails";
import NavBar from "@/components/layout/NavBar";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-4 lg:gap-10 min-h-svh p-6">
      <NavBar />

      <div className="grid gap-2 lg:gap-10">
        <div className="flex gap-2 items-center text-xl">
          <p>Token:</p>
          <p className="opacity-60 font-mono text-sm break-all">{id}</p>
        </div>

        <TokenDetail tokenId={id} />
      </div>
    </div>
  );
}