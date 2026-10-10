'use client';
export default function Error({ reset }: {
    reset: () => void;
}) { return <main className="glass-panel panel max-w-xl mx-auto my-10"><p className="eyebrow">WORKSPACE UNAVAILABLE</p><h1 className="text-2xl font-semibold">We couldn’t load this club page.</h1><p className="subtext mt-3">Please try again. If this is a fresh local setup, make sure the database has been generated and initialized.</p><button onClick={reset} className="button mt-5">Try again</button></main>; }
