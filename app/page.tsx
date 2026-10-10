import ChainInformation from "@/blocks/home/ChainInformation"
import DevTools from "@/blocks/home/DevTools"
import Search from "@/blocks/home/Search"

import LatestBlocks from "@/components/LatestBlocks"
import LatestTransactions from "@/components/LatestTransactions"
import NavBar from "@/components/layout/NavBar"

export default function Page() {
  return (
    <div className="flex flex-col gap-4 lg:gap-10 min-h-svh p-6">
      <NavBar />

      <div className="relative flex min-w-0 flex-col gap-4 text-sm leading-loose">
        <img
          src="blue-waves.png"
          alt="Logo"
          className="absolute inset-0 w-full h-full object-cover -z-10 opacity-30"
        />

        <Search />
      </div>

      <ChainInformation />

      <DevTools />

      <div className="grid lg:grid-cols-2 gap-2 lg:gap-10">
        <LatestBlocks limit={10} pollMs={3000} />

        <LatestTransactions limit={10} pollMs={3000} />
      </div>
    </div>
  )
}