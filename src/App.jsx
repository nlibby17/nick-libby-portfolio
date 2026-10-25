import { useCallback, useEffect, useState } from "react";
import Hero from "./components/Hero.jsx";
import ProjectCard from "./components/ProjectCard.jsx";
import ProjectPage from "./pages/ProjectPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import { projects, getProject } from "./data/projects.js";

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((to) => {
    window.history.pushState({}, "", to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);
  return [path, navigate];
}

function Nav({ onNavigate }) {
  const go = (to) => (e) => {
    e.preventDefault();
    onNavigate(to);
  };
  return (
    <nav className="site-nav">
      <a className="brand" href="/" onClick={go("/")}>
        NICK LIBBY
      </a>
      <div className="links">
        <a href="/" onClick={go("/")}>
          Home
        </a>
        <a href="/about" onClick={go("/about")}>
          About
        </a>
        <a
          href="https://github.com/nlibby17"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <p className="ornament" aria-hidden="true">
        ◆ ◆ ◆
      </p>
      <div className="links">
        <a href="https://github.com/nlibby17" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/nicholas-libby-485aba162"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
      </div>
      <p className="fine">Nick Libby · Marlborough, Massachusetts</p>
    </footer>
  );
}

function Landing({ onNavigate }) {
  return (
    <>
      <Hero />
      <div className="ornament" aria-hidden="true">
        ─ ◆ ─
      </div>
      <section className="cards" id="projects">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} onNavigate={onNavigate} />
        ))}
      </section>
      <section className="about-strip">
        <p>
          Data analytics student at SNHU, working in Python, SQL, and Excel.
          The work I enjoy most starts with a messy dataset and a real
          question.
        </p>
        <a
          href="/about"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/about");
          }}
        >
          More about me →
        </a>
      </section>
    </>
  );
}

export default function App() {
  const [path, navigate] = useRoute();

  let main;
  if (path === "/about") {
    main = <AboutPage />;
  } else if (path.startsWith("/projects/")) {
    const project = getProject(path.slice("/projects/".length));
    main = project ? (
      <ProjectPage project={project} onNavigate={navigate} />
    ) : (
      <Landing onNavigate={navigate} />
    );
  } else {
    main = <Landing onNavigate={navigate} />;
  }

  return (
    <>
      <Nav onNavigate={navigate} />
      {main}
      <Footer />
    </>
  );
}
