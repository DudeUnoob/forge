export default function GridOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 h-full w-full">
      <svg
        className="absolute inset-0 h-full w-full opacity-5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="blueprint-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blueprint-grid)" className="text-pure-white" />
      </svg>
    </div>
  );
}
