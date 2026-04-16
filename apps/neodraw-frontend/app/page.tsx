import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Pencil, Share2, Users2, Sparkles, Github, Download } from "lucide-react";
import Link from "next/link";

function App() {
  return (
    <div className="min-h-screen overflow-hidden bg-white text-black antialiased">
      
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-black/10">
        <div className="container mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-tight">
              Collaborative Whiteboarding
              <span className="block text-black/60">
                Made Simple
              </span>
            </h1>

            <p className="mt-6 text-lg text-black/60 leading-relaxed">
              Create, collaborate, and share beautiful diagrams and sketches with our intuitive drawing tool.
              No sign-up required.
            </p>

            <div className="mt-10 flex justify-center gap-4">
              <Link href={"/signin"}>
                <Button
                  variant={"primary"}
                  size="lg"
                  className="h-12 px-8 bg-black text-white rounded-xl hover:bg-black/90 transition-all"
                >
                  Sign in
                  <Pencil className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <Link href="/signup">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 rounded-xl border-black/20 hover:bg-black hover:text-white transition-all"
                >
                  Sign up
                </Button>
              </Link>

              <Link href="/joinroom">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 rounded-xl border-black/20 hover:bg-black hover:text-white transition-all"
                >
                  Join the Room
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-black/[0.02]">
        <div className="container mx-auto px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">

            {[ 
              {
                icon: Share2,
                title: "Real-time Collaboration",
                desc: "Work together with your team in real-time. Share instantly with a simple link."
              },
              {
                icon: Users2,
                title: "Multiplayer Editing",
                desc: "Multiple users can edit the same canvas simultaneously in real-time."
              },
              {
                icon: Sparkles,
                title: "Smart Drawing",
                desc: "Shape recognition and intelligent tools help you create perfect diagrams."
              }
            ].map((item, i) => (
              <Card
                key={i}
                className="p-8 rounded-2xl border border-black/10 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-black text-white">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>

                <p className="mt-4 text-black/60 leading-relaxed">
                  {item.desc}
                </p>
              </Card>
            ))}

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          
          <div className="rounded-3xl border border-black/10 bg-black text-white p-12 text-center relative overflow-hidden">
            
            {/* subtle gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            <h2 className="text-3xl sm:text-4xl font-semibold">
              Ready to start creating?
            </h2>

            <p className="mt-4 text-white/70 max-w-xl mx-auto">
              Join thousands of users creating diagrams and sketches effortlessly.
            </p>

            <div className="mt-10 flex justify-center gap-4">
              
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 rounded-xl bg-white text-black hover:bg-white/90 transition"
              >
                Open Canvas
                <Pencil className="ml-2 h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 rounded-xl border-white/30 text-white hover:bg-white hover:text-black transition"
              >
                View Gallery
              </Button>

            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/10">
        <div className="container mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          
          <p className="text-sm text-black/50">
            © 2026 NeoDraw. All rights reserved.
          </p>

          <div className="flex gap-6">
            <a className="text-black/50 hover:text-black transition" href="https://github.com/Kartik-619/NeoDraw.git">
              <Github className="h-5 w-5" />
            </a>
            <a className="text-black/50 hover:text-black transition">
              <Download className="h-5 w-5" />
            </a>
          </div>

        </div>
      </footer>

    </div>
  );
}
export default App;