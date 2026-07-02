# Eclipse Plugin Deployment and Marketplace Registration Guide

This document outlines the end-to-end process for deploying an extension to the Eclipse IDE and publishing it on the Eclipse Marketplace.

## 1. Architectural Overview: Eclipse and OSGi

Unlike Node.js-based IDEs (such as VS Code), Eclipse is built on Java and the **OSGi (Open Services Gateway initiative)** framework. 
- An Eclipse plugin is essentially an OSGi **bundle**. 
- Bundles declare their dependencies and export their functionalities via a `MANIFEST.MF` file.
- Integration with the Eclipse UI (menus, views, editors) is achieved through **Extension Points** defined in a `plugin.xml` file.

> [!NOTE]
> Moving from a web-technology-based extension to Eclipse requires transitioning from JavaScript/TypeScript to Java and the SWT/JFace UI toolkits.

## 2. The Development Environment (PDE)

Development is conducted using the **Plugin Development Environment (PDE)**, which is built into the "Eclipse IDE for RCP and RAP Developers" package. The PDE provides specialized editors for the manifest files and tools to launch a sandboxed "Runtime Eclipse" for testing the plugin without affecting the host IDE.

## 3. Packaging: Features and Update Sites (P2 Repositories)

Eclipse does not distribute plugins as single standalone installation files (like `.vsix` for VS Code). Instead, it uses a provisioning platform called **p2**.

1. **Features:** A plugin (or multiple related plugins) is wrapped in a "Feature." A Feature provides a version number, licensing information, and branding.
2. **Update Site (P2 Repository):** Features are bundled into an Update Site. This is a standard directory structure containing `artifacts.jar`, `content.jar`, and a `features/` and `plugins/` directory.

## 4. Hosting the Update Site

To make the plugin available to users, the Update Site directory must be hosted on a public-facing web server. 
- The server only needs to serve static files. 
- Common cost-effective solutions include GitHub Pages, Amazon S3, or any standard Apache/Nginx web server.
- The URL to this directory becomes the "Update Site URL" that users (and the Marketplace) will use to download the plugin.

## 5. Eclipse Marketplace Registration

The Eclipse Marketplace is a directory that points to hosted Update Sites.

1. **Account Creation:** Register an account with the Eclipse Foundation.
2. **Submission:** Navigate to the Eclipse Marketplace and create a new listing ("Add Content").
3. **Listing Details:** Provide the plugin name, a detailed description, categorized tags, and a 110x80 pixel logo.
4. **Update Site Link:** Crucially, provide the URL to the hosted Update Site from Step 4.
5. **Moderation:** The submission enters a moderation queue. Once approved by the Eclipse Foundation, the plugin becomes searchable and installable directly from the Eclipse IDE via the Marketplace Client.
