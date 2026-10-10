import AddressDetail from "@/blocks/address/AddressDetail";
import NavBar from "@/components/layout/NavBar";

export default async function Page({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = await params;

  return (
    <div className="flex flex-col gap-4 lg:gap-10 min-h-svh p-6">
      <NavBar />

      <div className="grid gap-2 lg:gap-10">
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 items-center text-xl">
            <p>Address:</p>
          </div>
          <p className="opacity-60 font-mono text-sm break-all">{addr}</p>
        </div>

        <AddressDetail address={addr} />
      </div>
    </div>
  );
}