import React, { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { AdminDashboardEnhanced } from "./components/AdminDashboardEnhanced";
import { UserDashboard } from "./components/UserDashboard";
import { UseCaseOwnerDashboard } from "./components/UseCaseOwnerDashboard";
import { ProjectDetail } from "./components/ProjectDetail";
import { TensionDetail } from "./components/TensionDetail";
import { UseCaseOwnerDetail } from "./components/UseCaseOwnerDetail";
import { UseCaseDetail } from "./components/UseCaseDetail";
import { EvaluationForm } from "./components/EvaluationForm";
import { SharedArea } from "./components/SharedArea";
import { OtherMembers } from "./components/OtherMembers";
import { PreconditionApproval } from "./components/PreconditionApproval";
import {
  User,
  Project,
  Tension,
  UseCaseOwner,
  UseCase,
} from "./types";
import {
  mockProjects,
  mockUsers,
  mockUseCases,
} from "./utils/mockData";

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(
    null,
  );
  const [currentView, setCurrentView] =
    useState<string>("dashboard");
  const [selectedProject, setSelectedProject] =
    useState<Project | null>(null);
  const [selectedTension, setSelectedTension] =
    useState<Tension | null>(null);
  const [selectedOwner, setSelectedOwner] =
    useState<UseCaseOwner | null>(null);
  const [selectedUseCase, setSelectedUseCase] =
    useState<UseCase | null>(null);
  const [projects, setProjects] =
    useState<Project[]>(mockProjects);
  const [useCases, setUseCases] =
    useState<UseCase[]>(mockUseCases);
  const [users] = useState<User[]>(mockUsers);
  const [needsPrecondition, setNeedsPrecondition] =
    useState(false);

  const handleLogin = (
    email: string,
    password: string,
    role: string,
  ) => {
    // Mock authentication
    const user = mockUsers.find(
      (u) => u.email === email && u.role === role,
    );
    if (user) {
      setCurrentUser(user);
      if (role !== "admin") {
        setNeedsPrecondition(true);
      }
    }
  };

  const handlePreconditionApproval = () => {
    setNeedsPrecondition(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("dashboard");
    setSelectedProject(null);
    setNeedsPrecondition(false);
  };

  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setCurrentView("project-detail");
  };

  const handleStartEvaluation = (project: Project) => {
    setSelectedProject(project);
    setCurrentView("evaluation");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setSelectedProject(null);
    setSelectedTension(null);
    setSelectedOwner(null);
    setSelectedUseCase(null);
  };

  const handleViewTension = (tension: Tension) => {
    setSelectedTension(tension);
    setCurrentView("tension-detail");
  };

  const handleBackToProject = () => {
    setCurrentView("project-detail");
    setSelectedTension(null);
    setSelectedOwner(null);
  };

  const handleViewOwner = (owner: UseCaseOwner) => {
    setSelectedOwner(owner);
    setCurrentView("owner-detail");
  };

  const handleViewUseCase = (useCase: UseCase) => {
    setSelectedUseCase(useCase);
    setCurrentView("usecase-detail");
  };

  const handleCreateProject = (
    projectData: Partial<Project>,
  ) => {
    const newProject: Project = {
      id: Date.now().toString(),
      title: projectData.title || "",
      shortDescription: projectData.shortDescription || "",
      fullDescription: projectData.fullDescription || "",
      stage: "set-up",
      status: "ongoing",
      targetDate: projectData.targetDate || "",
      assignedUsers: projectData.assignedUsers || [],
      createdAt: new Date().toISOString(),
      isNew: true,
      progress: 0,
    };
    setProjects([newProject, ...projects]);
  };

  const handleCreateUseCase = (
    useCaseData: Partial<UseCase>,
  ) => {
    const newUseCase: UseCase = {
      id: `uc${Date.now()}`,
      title: useCaseData.title || "",
      description: useCaseData.description || "",
      aiSystemCategory: useCaseData.aiSystemCategory || "",
      status: "assigned",
      progress: 0,
      ownerId: currentUser?.id || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supportingFiles: useCaseData.supportingFiles || [],
    };
    setUseCases([newUseCase, ...useCases]);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (needsPrecondition) {
    return (
      <PreconditionApproval
        userRole={currentUser.role}
        onApproval={handlePreconditionApproval}
        onBack={handleLogout}
      />
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case "project-detail":
        return selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            currentUser={currentUser}
            users={users}
            onBack={handleBackToDashboard}
            onStartEvaluation={() =>
              handleStartEvaluation(selectedProject)
            }
            onViewTension={handleViewTension}
            onViewOwner={handleViewOwner}
          />
        ) : null;
      case "tension-detail":
        return selectedTension ? (
          <TensionDetail
            tension={selectedTension}
            currentUser={currentUser}
            users={users}
            onBack={handleBackToProject}
          />
        ) : null;
      case "owner-detail":
        return selectedOwner ? (
          <UseCaseOwnerDetail
            owner={selectedOwner}
            currentUser={currentUser}
            users={users}
            onBack={handleBackToProject}
            onViewTension={handleViewTension}
          />
        ) : null;
      case "evaluation":
        return selectedProject ? (
          <EvaluationForm
            project={selectedProject}
            currentUser={currentUser}
            onBack={() => setCurrentView("project-detail")}
            onSubmit={handleBackToDashboard}
          />
        ) : null;
      case "shared-area":
        return (
          <SharedArea
            currentUser={currentUser}
            projects={projects}
            onBack={handleBackToDashboard}
          />
        );
      case "other-members":
        return (
          <OtherMembers
            currentUser={currentUser}
            users={users}
            projects={projects}
            onBack={handleBackToDashboard}
          />
        );
      case "usecase-detail":
        return selectedUseCase ? (
          <UseCaseDetail
            useCase={selectedUseCase}
            currentUser={currentUser}
            users={users}
            onBack={handleBackToDashboard}
          />
        ) : null;
      default:
        if (currentUser.role === "use-case-owner") {
          return (
            <UseCaseOwnerDashboard
              currentUser={currentUser}
              useCases={useCases}
              onCreateUseCase={handleCreateUseCase}
              onViewUseCase={handleViewUseCase}
              onLogout={handleLogout}
            />
          );
        } else if (currentUser.role === "admin") {
          return (
            <AdminDashboardEnhanced
              currentUser={currentUser}
              projects={projects}
              users={users}
              onViewProject={handleViewProject}
              onStartEvaluation={handleStartEvaluation}
              onCreateProject={handleCreateProject}
              onNavigate={setCurrentView}
              onLogout={handleLogout}
            />
          );
        } else {
          return (
            <UserDashboard
              currentUser={currentUser}
              projects={projects}
              users={users}
              onViewProject={handleViewProject}
              onStartEvaluation={handleStartEvaluation}
              onNavigate={setCurrentView}
              onLogout={handleLogout}
            />
          );
        }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderContent()}
    </div>
  );
}

export default App;