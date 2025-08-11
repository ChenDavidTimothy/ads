import Link from "next/link";
import { api, HydrateClient } from "@/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Motion <span className="text-[hsl(280,100%,70%)]">Studio</span>
          </h1>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition-colors"
              href="/workspace-selector"
            >
              <h3 className="text-2xl font-bold">Visual Editor →</h3>
              <div className="text-lg">
                Create animations using timeline-based animation nodes with sequential logic flow.
              </div>
            </Link>
            
            <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4">
              <h3 className="text-2xl font-bold">Node-Based System</h3>
              <div className="text-lg">
                Connect geometry, timing, and animation nodes to build complex sequences without code.
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-2xl text-white">
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>
            
            <Link href="/workspace-selector">
              <div className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 text-lg font-semibold text-white transition-colors">
                Start Creating →
              </div>
            </Link>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}