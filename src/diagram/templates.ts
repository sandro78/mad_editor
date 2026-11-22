export const starterDiagram = `flowchart LR
  A[User request] --> B{Valid Mermaid?}
  B -->|Yes| C[Render SVG]
  B -->|No| D[Show an error]
  C --> E[Export or save]

  classDef primary fill:#7367f0,stroke:#a9a2ff,color:#fff,stroke-width:2px
  class A,C primary`

export const templates = {
  Flowchart: `flowchart TD
  Start([Start]) --> Input[/Enter data/]
  Input --> Check{Validate}
  Check -->|Yes| Done([Done])
  Check -->|No| Input`,
  Sequence: `sequenceDiagram
  participant U as User
  participant A as Application
  participant S as Server
  U->>A: Open diagram
  A->>S: Request data
  S-->>A: Result
  A-->>U: Show diagram`,
  Class: `classDiagram
  class Diagram {
    +string source
    +render()
    +exportPng()
  }
  class Editor { +updateSource() }
  Editor --> Diagram`,
}
