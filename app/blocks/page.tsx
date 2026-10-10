import BlocksList from "@/blocks/blocks/BlocksList";
import NavBar from "@/components/layout/NavBar";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 lg:gap-10 min-h-svh p-6">
      <NavBar />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium">Blocks</h1>
        <p className="text-sm text-muted-foreground">
          Every block the chain has produced, newest first.
        </p>
      </div>

      <BlocksList />
    </div>
  );
}