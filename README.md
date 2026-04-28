# SmartWorkFlowX - Frontend

SmartWorkFlowX is an enterprise-grade workflow management system designed for seamless task orchestration, dynamic approval workflows, and role-based access control.

## Live Demo

The frontend is deployed and accessible at:
**[https://smart-work-flow-x-frontend.vercel.app](https://smart-work-flow-x-frontend.vercel.app)**

### Admin Login Credentials
To test out full administrative capabilities (Workflow Builder, User Management, Audit Logs), use the following seed credentials out-of-the-box:
- **Email:** `admin@smartworkflowx.com`
- **Password:** `password123`

---

## Hosting Architecture

The application is fully deployed to the cloud utilizing modern CI/CD pipelines:
- **Frontend Hosting:** [Vercel](https://vercel.com/) (Automatically builds and deploys via GitHub integration)
- **Backend API:** Microsoft Azure App Service (F1 Free Tier)
- **Database:** Azure SQL Database (Cloud-hosted relational database)
- **CI/CD:** GitHub Actions handles the continuous integration and deployment of the .NET backend API to Azure.

---

## Local Quick Start

**Prerequisites:** 
Ensure the internal SmartWorkFlowX .NET Backend API is running on `https://localhost:52082`.

```bash
# 1. Clone the repository
git clone https://github.com/Archit-Chauhan/SmartWorkFlowX_Frontend.git

# 2. Enter the directory
cd SmartWorkFlowX_Frontend

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

Your app will be automatically running at `http://localhost:5173`.
