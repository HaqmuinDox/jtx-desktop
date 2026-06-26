# Renew — AIP Ontology Hub: Architecture & Planned Petri Net Branch

## Overview

The AIP Ontology acts as the **central conversion hub** in the Renew project. All representations — Java source code, diagram drawings, and Occurrence Nets — pass through it. This document describes the current architecture and what it would look like after adding a direct Petri Net (Simulator model) branch.

---

## Current Architecture

### Conversion Pipeline

```
Java Source Code
      │
      │  JavaCodeParser  (uses JavaParser library, call depth limit: 5)
      ▼
   MethodAst                          ← AST layer: captures code structure
  (StatementSequence,
   IfElement, LoopElement,
   MethodCallElement,
   ReturnElement, BreakElement, ...)
      │
      │  AipAstVisitor
      ▼
┌──────────────────────────────────┐
│          AIP Ontology            │  ← central hub: captures interaction semantics
│                                  │
│  Aip                             │
│  ├── Set<AipLifeLine>            │
│  │     ├── TaskElement           │
│  │     ├── LifeLineXorSplit      │
│  │     ├── LifeLineXorJoin       │
│  │     ├── LifeLineIterator      │
│  │     └── LifeLineMessage       │
│  └── Set<AipMessage>             │
└──────────┬───────────────────────┘
           │
     ┌─────┴──────────┐
     ▼                ▼
Diagram           OccurrenceNetSystem
Drawing           (NetElement, Arc —
(figures,          built in-place by
 layout)           AipAppendBuilder)
```

### AST Node Reference

| Class | Description |
|-------|-------------|
| `MethodAst` | Root node; holds body, role name, signature, return type, params |
| `StatementSequence` | Ordered `List<StatementElement>` |
| `StatementElement` | Base for all statements |
| `IfElement` | Condition + then-branch + else-branch |
| `LoopElement` | Loop header + body + optional label |
| `MethodCallElement` | Reference to called `MethodAst` + calling role name |
| `ReturnElement` | Return value expression |
| `BreakElement` / `ContinueElement` | Loop control |

### AST → AIP Ontology Mappings (via `AipAstVisitor`)

| AST Node | AIP Ontology Element |
|----------|---------------------|
| `MethodAst` | Trigger lifeline + messages + destruction |
| `MethodCallElement` | Synchronous messages between lifelines |
| `IfElement` | `LifeLineXorSplitElement` + `LifeLineXorJoinElement` |
| `LoopElement` | `LifeLineIteratorElement` (forEach / forAll) |
| `ReturnElement` | Reply message |

---

## The Gap: DiaRoundtrip Bypasses the Hub

DiaRoundtrip's Petri Net generation currently **does not go through the AIP Ontology**. It works directly with diagram figures and an XML intermediate format:

```
AIP Diagram Figures
      │  PeerGenerator  (reads AIP XML)
      ▼
  CPNDrawing  (NetComponentFigure elements)
      │  PeerGraphBuilder
      ▼
  PetriNetNode graph  (abstract graph)
      │  XmlGraphGenerator
      ▼
  XML intermediate representation
      │  PetriNetChangeDetector
      ▼
  DiffResult → propagated back to AIP figures
```

It never touches `Aip`, `AipLifeLine`, or any ontology class. The XML format is the canonical form used for change detection, not the net model itself.

---

## Two Separate Petri Net Models in the Codebase

There are two distinct Petri Net model hierarchies that the new branch must distinguish between:

| Aspect | Simulator Net (`de.renew.net`) | OccurrenceNet (`de.renew.occurrencenet.model`) |
|--------|-------------------------------|------------------------------------------------|
| Purpose | Runtime simulation/execution | AIP representation and analysis |
| Places/Transitions | Concrete classes (`Place`, `Transition`) | `NetElement` interface (unified for both) |
| Arcs | Implicit in references | Explicit `Arc` interface |
| Graph library | None — direct references | JGraphT `SimpleDirectedGraph` |
| Creation | Constructor `Net()` | Factory methods on `OccurrenceNet` interface |
| Used by | `SimulationManager` | `AipAppendBuilder`, ontology layer |

The OccurrenceNet model is already wired into the hub (built in-place by `AipAppendBuilder`). The **Simulator Net is not**.

---

## Planned Architecture: With the Petri Net Branch

```
Java Source Code
      │
      │  JavaCodeParser
      ▼
   MethodAst
      │
      │  AipAstVisitor
      ▼
┌──────────────────────────────────┐
│          AIP Ontology            │
│  (Aip, AipLifeLine,              │
│   TaskElement,                   │
│   LifeLineXorSplitElement,       │
│   LifeLineIteratorElement,       │
│   AipMessage, ...)               │
└──────────┬───────────────────────┘
           │
     ┌─────┼──────────────────┐
     ▼     ▼                  ▼
Diagram  OccurrenceNet      Net          ← NEW BRANCH
Drawing  System             (Simulator model:
                             Net, Place,
                             Transition,
                             inscriptions)
```

### Existing Output Branches — Pattern to Follow

| Branch | Converter | Direction |
|--------|-----------|-----------|
| → Diagram Drawing | `AipExporter` / `AipImporter` | bidirectional |
| → OccurrenceNetSystem | `AipAppendBuilder` (internal) | write-only (built in-place) |
| → **Net (Simulator)** | **`AipNetConverter`** *(new)* | bidirectional or write-first |

### Element-Level Mapping (AIP Ontology → Simulator Net)

| AIP Ontology Element | Simulator Net Equivalent |
|----------------------|--------------------------|
| `AipLifeLine` | Sequential chain of `Place` → `Transition` → `Place` ... inside `Net` |
| `TaskElement` | `Transition` |
| `LifeLineXorSplitElement` | A `Transition` (condition event) feeding into branching `Place`s |
| `LifeLineXorJoinElement` | A `Transition` merging from branching `Place`s |
| `LifeLineIteratorElement` | Loop: `Place` → `Transition` → `Place` with a back-arc |
| `AipMessage` (synchronous) | `UplinkInscription` on a `Transition` (Renew's channel mechanism) |

---

## Architectural Payoff

Grounding the new branch in the hub would allow DiaRoundtrip's current XML-based pipeline to be replaced or complemented with a direct path:

```
Current:  AIP Figures → PeerGenerator → CPNDrawing → PetriNetNode → XML → Diff
Possible: AIP Ontology → AipNetConverter → Net  (direct, no XML needed)
```

The DiaRoundtrip comparison logic could then operate on `Net` objects directly, using the ontology as the single source of truth rather than regenerating structure from XML diffs against diagram figures.

---

## Key Files Reference

| File | Plugin | Role |
|------|--------|------|
| `codeview/ast/AstElement.java` | OccurrenceNet | Base AST interface |
| `codeview/ast/MethodAst.java` | OccurrenceNet | Root AST node |
| `codeview/impl/JavaCodeParser.java` | OccurrenceNet | Java → AST |
| `codeview/aip/impl/AipAstVisitor.java` | OccurrenceNet | AST → AIP Ontology |
| `codeview/aip/ontology/impl/AipAppendBuilder.java` | OccurrenceNet | Builds AIP + OccurrenceNet in-place |
| `codeview/aip/AipExporter.java` | OccurrenceNet | AIP Ontology → Diagram Drawing |
| `codeview/aip/AipImporter.java` | OccurrenceNet | Diagram Drawing → AIP Ontology |
| `model/OccurrenceNet.java` | OccurrenceNet | OccurrenceNet interface (JGraphT-backed) |
| `model/OccurrenceNetSystem.java` | OccurrenceNet | Container: net + marking |
| `de/renew/net/Net.java` | Simulator:Impl | Simulator Petri Net (concrete) |
| `de/renew/net/Place.java` | Simulator:Impl | Place (concrete) |
| `de/renew/net/Transition.java` | Simulator:Impl | Transition (concrete) |
| `generation/PeerGenerator.java` | DiaRoundtrip | AIP XML → CPNDrawing (bypasses ontology) |
| `analysis/PeerGraphBuilder.java` | DiaRoundtrip | CPNDrawing → PetriNetNode graph |
| `generation/XmlGraphGenerator.java` | DiaRoundtrip | PetriNetNode → XML |
| `diff/impl/PetriNetChangeDetectorImpl.java` | DiaRoundtrip | Compares two XML graphs |
