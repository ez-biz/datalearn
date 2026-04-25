import Link from "next/link"
import { NewsFeed } from "@/components/NewsFeed"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-50">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Antigravity Data Learning Platform
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <Link href="/api/auth/signin" className="p-2 underline text-blue-600">
            Sign In
          </Link>
          <Link href="/profile" className="p-2 underline text-blue-600 ml-4">
            Profile
          </Link>
        </div>
      </div>

      <div className="relative flex flex-col place-items-center text-center max-w-4xl mx-auto z-10 pt-20">
        <div className="mb-8 inline-flex items-center rounded-full border px-3 py-1 text-sm bg-gray-50 text-gray-800">
          <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2"></span>
          Beta Release v0.1
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 mb-6">
          Master the Art of <br />
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Data Engineering</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Learn SQL, Python, ETL Pipelines, and System Design through interactive coding challenges and real-world projects. No setup required.
        </p>
        <div className="flex gap-4 flex-col sm:flex-row">
          <Link
            href="/learn"
            className="px-8 py-3 bg-black text-white dark:bg-white dark:text-black rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            Start Learning
          </Link>
          <Link
            href="/practice"
            className="px-8 py-3 bg-white text-black border border-gray-200 rounded-full font-semibold hover:bg-gray-50 transition-colors"
          >
            Solve Problems
          </Link>
        </div>
      </div>

      <div className="mt-20 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-white rounded-lg border shadow-sm">
          <h2 className="text-2xl font-bold mb-4">Start Learning</h2>
          <p className="text-gray-600 mb-6">
            Dive into our comprehensive curriculum covering SQL, Python, ETL, and System Design.
          </p>
          <Link href="/learn" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
            Browse Topics &rarr;
          </Link>
        </div>
        <div className="w-full">
          <NewsFeed />
        </div>
      </div>
    </main>
  )
}
