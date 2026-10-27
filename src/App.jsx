import { useCallback, useEffect, useState } from "react";
import Hero from "./components/Hero.jsx";
import ProjectCard from "./components/ProjectCard.jsx";
import AsciiField from "./components/AsciiField.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
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
        <a
          href="https://www.linkedin.com/in/nicholas-libby-485aba162"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
      </div>
    </nav>
  );
}

function Footer() {
  // The GitHub and LinkedIn links that used to live here
  // moved into the header on Oct 27, 2026 (Nick's call: the
  // small footer text links were too easy to miss). The
  // footer is now a closing ornament and nothing more.
  return (
    <footer className="site-footer">
      <p className="ornament" aria-hidden="true">
        ◆ ◆ ◆
      </p>
    </footer>
  );
}

function Landing({ onNavigate }) {
  return (
    <>
      <div className="sun-backdrop" aria-hidden="true">
        <ErrorBoundary>
          <AsciiField variant="sun" opacity={0.5} />
        </ErrorBoundary>
      </div>
      <main className="landing-main">
        <ErrorBoundary>
          <Hero />
        </ErrorBoundary>
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
      </main>
    </>
  );
}

export default function App() {
  const [path, navigate] = useRoute();

  let main;
  let inner = false;
  let about = false;
  if (path === "/about") {
    main = <AboutPage />;
    about = true;
  } else if (path.startsWith("/projects/")) {
    const project = getProject(path.slice("/projects/".length));
    if (project) {
      main = <ProjectPage project={project} onNavigate={navigate} />;
      inner = true;
    } else {
      main = <Landing onNavigate={navigate} />;
    }
  } else {
    main = <Landing onNavigate={navigate} />;
  }

  return (
    <>
      <Nav onNavigate={navigate} />
      {inner ? (
        <div
          className={
            main.props.project && main.props.project.backdrop
              ? "deco-page-bg deco-page-bg--plain"
              : "deco-page-bg"
          }
        >
          {main}
        </div>
      ) : about ? (
        <div>{main}</div>
      ) : (
        main
      )}
      <Footer />
    </>
  );
}
