# Eclipse Plugin Development Roadmap and Testing Strategy

This roadmap defines the milestones required to migrate and develop the extension for the Eclipse IDE. It includes detailed instructions for testing within the unfamiliar Eclipse environment.

## Milestone 1: Environment Setup
- **Goal:** Establish the Eclipse Plugin Development Environment (PDE).
- **Actions:** 
  - Download and install "Eclipse IDE for RCP and RAP Developers".
  - Configure the Workspace and Target Platform (the version of Eclipse the plugin is built against).

## Milestone 2: Project Scaffolding
- **Goal:** Create the OSGi bundle structure.
- **Actions:**
  - Create a new "Plug-in Project".
  - Configure `MANIFEST.MF` with necessary dependencies (e.g., `org.eclipse.ui`, `org.eclipse.core.runtime`).
  - Define basic extension points in `plugin.xml`.

## Milestone 3: Core UI Implementation
- **Goal:** Recreate the extension's user interface.
- **Actions:**
  - Implement Views, Editors, or Dialogs using SWT (Standard Widget Toolkit) and JFace.
  - Bind UI events to underlying Java command handlers.

## Milestone 4: Business Logic and Proxy Integration
- **Goal:** Connect the UI to the backend systems.
- **Actions:**
  - Implement HTTP clients in Java to communicate with the Client-Server Proxy.
  - Handle asynchronous tasks (using Eclipse Jobs API) to ensure the IDE UI does not freeze during network calls.

## Milestone 5: Packaging and Update Site Creation
- **Goal:** Prepare the plugin for distribution.
- **Actions:**
  - Create a Feature Project to wrap the plugin.
  - Create an Update Site Project and build the P2 repository artifacts.
  - Host the resulting directory on a static web server.

## Milestone 6: Marketplace Deployment
- **Goal:** Publish the extension.
- **Actions:**
  - Submit the listing to the Eclipse Marketplace with the Update Site URL.
  - Complete the moderation process.

---

## Detailed Testing Strategy

Testing in Eclipse requires specific paradigms due to the OSGi framework.

> [!TIP]
> The most critical testing tool in Eclipse PDE is the "Runtime Eclipse Application" configuration. This launches a second, isolated instance of Eclipse with your plugin injected into it.

### 1. Manual Testing (The Sandbox)
**How to verify:**
1. Right-click the Plug-in Project in the Package Explorer.
2. Select `Run As` > `Eclipse Application`.
3. A new instance of Eclipse will launch. This is the sandbox.
4. Interact with your plugin in this new window. If it crashes, it only crashes the sandbox, not your development environment. Error logs will appear in your primary Eclipse console.

### 2. Unit Testing (JUnit and PDE Tests)
**How to verify:**
- Standard Java business logic (unrelated to the UI) can be tested using standard **JUnit**.
- Logic that interacts with the Eclipse API requires **PDE JUnit Tests**. This framework launches a headless (no UI) or minimal-UI instance of Eclipse to run the tests within the OSGi context.

### 3. Integration Testing (Update Site Verification)
**How to verify:**
1. Once the Update Site is built and hosted locally (or staged online), open a fresh installation of Eclipse (not your development instance).
2. Go to `Help` > `Install New Software...`.
3. Enter the URL of the Update Site.
4. Verify that Eclipse correctly resolves the plugin, handles the installation process, and restarts successfully with the plugin enabled.
