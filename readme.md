# 🛡️ SyncGuard AI

### *Automated Configuration Guardrails for Salesforce & HubSpot RevOps*

SyncGuard AI is a lightweight, stateless utility designed to audit configuration rules, workflows, and schemas before they are deployed to production. It acts as an automated QA engineer for Revenue Operations (RevOps), identifying internal logic conflicts and cross-platform sync friction before they cause silent data crashes or validation failures.

---

## 🎯 What Problem Does This Solve?

In modern cloud ecosystems, **Salesforce** (the CRM) and **HubSpot** (the Marketing Automation platform) are constantly talking to each other. 

* **The Trap:** A marketing operations manager builds a beautiful HubSpot workflow that automatically promotes a lead to "SQL". 
* **The Wall:** Unknown to them, a Salesforce Administrator recently deployed a strict Validation Rule requiring a `Phone Number` whenever a lead hits "SQL".
* **The Crash:** The next time a lead syncs, Salesforce rejects it because the phone number is missing. The data sync breaks silently, leads stack up in an error queue, and sales reps miss out on hot prospects.

**SyncGuard AI catches these hidden friction points in milliseconds** by reading your configuration files *before* you deploy them, tracing fields across systems, and warning you exactly where the "validation walls" are.

---

## 🧭 Three Modes of Protection

SyncGuard AI automatically adapts based on the files you upload, making it a valuable day-to-day utility for both developers and admins:

### 1. 🔗 Cross-System Sync Audit (All Files)
When you upload a field mapping schema, a HubSpot JSON workflow, and Salesforce XML metadata together, SyncGuard AI acts as a system bridge. It maps dependencies end-to-end to catch silent integration blocks.

### 2. ☁️ Salesforce Configuration Guard (Salesforce Only)
If you only upload Salesforce validation rules or metadata, the tool shifts gears. It audits your formulas for logical errors, watches for order-of-execution bottlenecks, and flags rules that might frustrate standard business users.

### 3. 🍊 HubSpot Workflow Guard (HubSpot Only)
If you only upload HubSpot workflow logic, the engine pivots to check automation health. It scans for potential runaway loops, bad data formatting steps, and missing segment criteria before you take the workflow live.

---

## 🛠️ Built With

* **Frontend:** React / TypeScript / Tailwind CSS
* **Hosting & Deployment:** Vercel (Serverless Functions)
* **AI Engine:** OpenAI `gpt-4o-mini` (Configured at `temperature: 0.1` for highly deterministic, accurate code audits)
* **Security Context:** Web Crypto API Fallbacks for cross-network local testing

---

## 🚀 Local Quickstart Guide

Want to run SyncGuard AI locally on your machine? Follow these simple steps.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### 1. Clone & Install
Open your terminal (or PowerShell) and navigate to your project directory:
```bash
cd SyncGuardAi
npm install 