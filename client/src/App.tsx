import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./auth/AuthContext";
import Login from "./pages/Login";
import api, { getAccessToken } from "./api/api";

type Project = {
  id: number;
  name: string;
  description: string | null;
  clientId: number;
  createdById: number;
  client?: {
    id: number;
    name: string;
  };
  _count?: {
    tasks: number;
  };
};

type Developer = {
  id: number;
  name: string;
  email: string;
};

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER";
  createdAt: string;
};

type Client = {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  _count?: {
    projects: number;
  };
};

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  projectId: number;
  assignedDeveloperId: number;
  assignedDeveloper?: Developer;
  project?: {
    id: number;
    name: string;
  };
};

type Activity = {
  id?: number;
  taskId: number;
  projectId: number;
  projectName?: string;
  project?: {
    id: number;
    name: string;
  };
  taskTitle?: string;
  fromStatus?: string;
  toStatus: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    role: string;
  };
  task?: {
    id: number;
    title: string;
  };
};

type Notification = {
  id: number;
  message: string;
  read: boolean;
  createdAt: string;
};

type Dashboard = {
  role: string;
  totalProjects?: number;
  overdueCount?: number;
  onlineUsers?: number;
  tasksByStatus?: {
    status: string;
    count: number;
  }[];
  projects?: {
    id: number;
    name: string;
    _count: {
      tasks: number;
    };
  }[];
  tasksByPriority?: {
    priority: string;
    count: number;
  }[];
  upcomingDueDates?: {
    id: number;
    title: string;
    priority: string;
    dueDate: string;
    projectId: number;
  }[];
  tasks?: Task[];
};

const statuses = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

const priorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const priorityOrder: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

function pluralize(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function timeAgo(dateString: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Renders the required "Ravi moved Task #12 from In Progress → In
// Review · 2 mins ago" shape from either the REST activity log shape
// or the live socket payload shape.
function formatActivityLine(activity: Activity) {
  const actor = activity.user?.name ?? "Someone";
  const taskId = activity.task?.id ?? activity.taskId;
  const from = activity.fromStatus
    ? formatStatus(activity.fromStatus)
    : "New";
  const to = formatStatus(activity.toStatus);
  return `${actor} moved Task #${taskId} from ${from} → ${to}`;
}

function App() {
  const {
    user,
    loading: authLoading,
    logout,
  } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState(0);

  const [dashboard, setDashboard] =
    useState<Dashboard | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managedUsers, setManagedUsers] =
    useState<ManagedUser[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] =
    useState<Activity[]>([]);
  const [globalActivities, setGlobalActivities] =
    useState<Activity[]>([]);
  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] =
    useState(false);

  const [selectedProject, setSelectedProject] =
    useState<Project | null>(null);

  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error]);

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const [showProjectForm, setShowProjectForm] =
    useState(false);

  const [showClientForm, setShowClientForm] =
    useState(false);

  const [showUserForm, setShowUserForm] =
    useState(false);

  const [usersTab, setUsersTab] = useState<
    "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER"
  >("ADMIN");

  const [editingProject, setEditingProject] =
    useState<Project | null>(null);

  const [editingClient, setEditingClient] =
    useState<Client | null>(null);

  const [editingTask, setEditingTask] =
    useState<Task | null>(null);

  const [showTaskForm, setShowTaskForm] =
    useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] =
    useState("");
  const [projectClientId, setProjectClientId] =
    useState("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] =
    useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] =
    useState("");
  const [newUserRole, setNewUserRole] =
    useState("DEVELOPER");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] =
    useState("");
  const [taskDeveloperId, setTaskDeveloperId] =
    useState("");
  const [taskPriority, setTaskPriority] =
    useState("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState("");

  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "PROJECT_MANAGER";

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!user) {
      return;
    }

    loadDashboard();
    loadNotifications();
    loadGlobalActivities();

    if (canManage) {
      loadProjects();
      loadClients();
      loadDevelopers();
    }

    if (isAdmin) {
      loadUsers();
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const token = getAccessToken();

    if (!token) {
      return;
    }

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ??
      "http://localhost:5000";

    const newSocket = io(socketUrl, {
      auth: {
        token,
      },
      withCredentials: true,
    });

    newSocket.on(
      "online-users",
      (data: { count: number }) => {
        setOnlineUsers(data.count);
      }
    );

    newSocket.on(
      "task-status-updated",
      (activity: Activity) => {
        setActivities((current) => [
          activity,
          ...current,
        ]);

        setTasks((current) =>
          current.map((task) =>
            task.id === activity.taskId
              ? {
                  ...task,
                  status: activity.toStatus,
                }
              : task
          )
        );
      }
    );

    newSocket.on(
      "global-activity",
      (activity: Activity) => {
        setGlobalActivities((current) => [
          activity,
          ...current,
        ].slice(0, 20));
      }
    );

    newSocket.on(
      "notification",
      (data: {
        notification: Notification;
        unreadCount: number;
      }) => {
        setNotifications((current) => [
          data.notification,
          ...current,
        ]);

        setUnreadCount(data.unreadCount);
      }
    );

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  async function loadDashboard() {
    try {
      const response = await api.get("/dashboard");
      setDashboard(response.data);
      setOnlineUsers(response.data.onlineUsers ?? 0);
    } catch {
      setError("Could not load dashboard");
    }
  }

  async function loadProjects() {
    try {
      setPageLoading(true);

      const response = await api.get("/projects");

      setProjects(response.data.projects);
    } catch {
      setError("Could not load projects");
    } finally {
      setPageLoading(false);
    }
  }

  async function loadClients() {
    try {
      const response = await api.get("/clients");

      setClients(response.data.clients);
    } catch {
      setError("Could not load clients");
    }
  }

  async function loadUsers() {
    try {
      const response = await api.get("/users");

      setManagedUsers(response.data.users);
    } catch {
      setError("Could not load users");
    }
  }

  async function loadDevelopers() {
    try {
      const response =
        await api.get("/users/developers");

      setDevelopers(response.data.developers);
    } catch {
      setError("Could not load developers");
    }
  }

  async function loadNotifications() {
    try {
      const response =
        await api.get("/notifications");

      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch {
      setError("Could not load notifications");
    }
  }

  async function loadGlobalActivities() {
    try {
      // No projectId => server returns the role-scoped feed:
      // Admin gets everything, PM gets their own projects,
      // Developer gets only their assigned tasks. This also covers
      // the "last 20 missed events while offline" requirement since
      // it's read straight from the database on every load.
      const response = await api.get("/activities/recent");
      setGlobalActivities(response.data.activities);
    } catch {
      setError("Could not load activity feed");
    }
  }

  async function loadActivities(projectId: number) {
    try {
      const response =
        await api.get(
          `/activities/recent?projectId=${projectId}`
        );

      setActivities(response.data.activities);
    } catch {
      setError("Could not load activity");
    }
  }

  async function loadTasks(projectId: number) {
    try {
      setPageLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (priorityFilter) {
        params.set("priority", priorityFilter);
      }

      if (fromFilter) {
        params.set(
          "from",
          new Date(
            `${fromFilter}T00:00:00`
          ).toISOString()
        );
      }

      if (toFilter) {
        params.set(
          "to",
          new Date(
            `${toFilter}T23:59:59`
          ).toISOString()
        );
      }

      const query = params.toString();

      const response = await api.get(
        `/tasks/project/${projectId}${
          query ? `?${query}` : ""
        }`
      );

      setTasks(response.data.tasks);
    } catch {
      setError("Could not load tasks");
    } finally {
      setPageLoading(false);
    }
  }

  async function openProject(project: Project) {
    setSelectedProject(project);

    if (socket) {
      socket.emit("join-project", project.id);
    }

    await loadTasks(project.id);
    await loadActivities(project.id);
  }

  async function createProject() {
    if (!projectName || !projectClientId) {
      setError(
        "Project name and client are required"
      );
      return;
    }

    try {
      await api.post("/projects", {
        name: projectName,
        description: projectDescription,
        clientId: Number(projectClientId),
      });

      resetProjectForm();
      await loadProjects();
      await loadDashboard();
    } catch {
      setError("Could not create project");
    }
  }

  async function updateProject() {
    if (!editingProject) {
      return;
    }

    try {
      await api.put(
        `/projects/${editingProject.id}`,
        {
          name: projectName,
          description: projectDescription,
          clientId: Number(projectClientId),
        }
      );

      resetProjectForm();
      await loadProjects();

      if (
        selectedProject?.id === editingProject.id
      ) {
        const response = await api.get(
          `/projects/${editingProject.id}`
        );

        setSelectedProject(response.data.project);
      }
    } catch {
      setError("Could not update project");
    }
  }

  async function deleteProject(id: number) {
    if (
      !window.confirm(
        "Delete this project and all its tasks?"
      )
    ) {
      return;
    }

    try {
      await api.delete(`/projects/${id}`);

      if (selectedProject?.id === id) {
        leaveProject();
      }

      await loadProjects();
      await loadDashboard();
    } catch {
      setError("Could not delete project");
    }
  }

  function startEditProject(project: Project) {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectDescription(
      project.description ?? ""
    );
    setProjectClientId(String(project.clientId));
    setShowProjectForm(true);
  }

  function resetProjectForm() {
    setProjectName("");
    setProjectDescription("");
    setProjectClientId("");
    setEditingProject(null);
    setShowProjectForm(false);
  }

  async function createClient() {
    if (!clientName) {
      setError("Client name is required");
      return;
    }

    try {
      await api.post("/clients", {
        name: clientName,
        email: clientEmail || undefined,
        company: clientCompany || undefined,
      });

      resetClientForm();
      await loadClients();
    } catch {
      setError("Could not create client");
    }
  }

  async function updateClient() {
    if (!editingClient) {
      return;
    }

    try {
      await api.put(
        `/clients/${editingClient.id}`,
        {
          name: clientName,
          email: clientEmail || undefined,
          company: clientCompany || undefined,
        }
      );

      resetClientForm();
      await loadClients();
      await loadProjects();
    } catch {
      setError("Could not update client");
    }
  }

  async function deleteClient(id: number) {
    if (
      !window.confirm("Delete this client?")
    ) {
      return;
    }

    try {
      await api.delete(`/clients/${id}`);
      await loadClients();
    } catch (error: any) {
      setError(
        error?.response?.data?.message ??
          "Could not delete client"
      );
    }
  }

  function startEditClient(client: Client) {
    setEditingClient(client);
    setClientName(client.name);
    setClientEmail(client.email ?? "");
    setClientCompany(client.company ?? "");
    setShowClientForm(true);
  }

  function resetClientForm() {
    setEditingClient(null);
    setClientName("");
    setClientEmail("");
    setClientCompany("");
    setShowClientForm(false);
  }

  async function createManagedUser() {
    if (
      !newUserName ||
      !newUserEmail ||
      !newUserPassword
    ) {
      setError("Name, email, and password are required");
      return;
    }

    if (newUserPassword.length < 8) {
      setError(
        "Password must be at least 8 characters"
      );
      return;
    }

    try {
      await api.post("/users", {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });

      resetUserForm();
      await loadUsers();
      await loadDevelopers();
    } catch (error: any) {
      setError(
        error?.response?.data?.message ??
          "Could not create user"
      );
    }
  }

  async function deleteManagedUser(id: number) {
    if (
      !window.confirm(
        "Delete this user? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
      await loadDevelopers();
    } catch (error: any) {
      setError(
        error?.response?.data?.message ??
          "Could not delete user"
      );
    }
  }

  function resetUserForm() {
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("DEVELOPER");
    setShowUserForm(false);
  }

  async function createTask() {
    if (
      !selectedProject ||
      !taskTitle ||
      !taskDeveloperId
    ) {
      setError(
        "Task title and developer are required"
      );
      return;
    }

    try {
      await api.post(
        `/tasks/project/${selectedProject.id}`,
        {
          title: taskTitle,
          description: taskDescription,
          assignedDeveloperId:
            Number(taskDeveloperId),
          priority: taskPriority,
          dueDate: taskDueDate
            ? new Date(
                `${taskDueDate}T23:59:59`
              ).toISOString()
            : undefined,
        }
      );

      resetTaskForm();

      await loadTasks(selectedProject.id);
      await loadDashboard();
    } catch {
      setError("Could not create task");
    }
  }

  async function updateTask() {
    if (!editingTask) {
      return;
    }

    try {
      await api.put(
        `/tasks/${editingTask.id}`,
        {
          title: taskTitle,
          description: taskDescription,
          assignedDeveloperId:
            Number(taskDeveloperId),
          priority: taskPriority,
          dueDate: taskDueDate
            ? new Date(
                `${taskDueDate}T23:59:59`
              ).toISOString()
            : undefined,
        }
      );

      resetTaskForm();

      if (selectedProject) {
        await loadTasks(selectedProject.id);
      }
    } catch {
      setError("Could not update task");
    }
  }

  function startEditTask(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskDeveloperId(
      String(task.assignedDeveloperId)
    );
    setTaskPriority(task.priority);

    setTaskDueDate(
      task.dueDate
        ? new Date(task.dueDate)
            .toISOString()
            .split("T")[0]
        : ""
    );

    setShowTaskForm(true);
  }

  function resetTaskForm() {
    setEditingTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeveloperId("");
    setTaskPriority("MEDIUM");
    setTaskDueDate("");
    setShowTaskForm(false);
  }

  async function updateTaskStatus(
    taskId: number,
    status: string
  ) {
    try {
      await api.put(`/tasks/${taskId}`, {
        status,
      });

      if (selectedProject) {
        await loadTasks(selectedProject.id);
      }

      await loadDashboard();
    } catch {
      setError("Could not update task");
    }
  }

  async function deleteTask(taskId: number) {
    if (
      !window.confirm("Delete this task?")
    ) {
      return;
    }

    try {
      await api.delete(`/tasks/${taskId}`);

      if (selectedProject) {
        await loadTasks(selectedProject.id);
      }

      await loadDashboard();
    } catch {
      setError("Could not delete task");
    }
  }

  async function markNotificationRead(
    notificationId: number
  ) {
    try {
      await api.patch(
        `/notifications/${notificationId}/read`
      );

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                read: true,
              }
            : notification
        )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    } catch {
      setError(
        "Could not update notification"
      );
    }
  }

  async function markAllRead() {
    try {
      await api.patch(
        "/notifications/read-all"
      );

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read: true,
        }))
      );

      setUnreadCount(0);
    } catch {
      setError(
        "Could not update notifications"
      );
    }
  }

  function applyFilters() {
    if (!selectedProject) {
      return;
    }

    const params = new URLSearchParams();

    if (statusFilter) {
      params.set("status", statusFilter);
    }

    if (priorityFilter) {
      params.set(
        "priority",
        priorityFilter
      );
    }

    if (fromFilter) {
      params.set("from", fromFilter);
    }

    if (toFilter) {
      params.set("to", toFilter);
    }

    const query = params.toString();

    window.history.replaceState(
      {},
      "",
      query
        ? `?project=${selectedProject.id}&${query}`
        : `?project=${selectedProject.id}`
    );

    loadTasks(selectedProject.id);
  }

  function clearFilters() {
    setStatusFilter("");
    setPriorityFilter("");
    setFromFilter("");
    setToFilter("");

    if (selectedProject) {
      window.history.replaceState(
        {},
        "",
        `?project=${selectedProject.id}`
      );

      api
        .get(
          `/tasks/project/${selectedProject.id}`
        )
        .then((response) =>
          setTasks(response.data.tasks)
        )
        .catch(() =>
          setError("Could not load tasks")
        );
    }
  }

  function leaveProject() {
    if (selectedProject && socket) {
      socket.emit(
        "leave-project",
        selectedProject.id
      );
    }

    setSelectedProject(null);
    setTasks([]);
    setActivities([]);
    resetTaskForm();
  }

  const sortedDeveloperTasks = [
    ...(dashboard?.tasks ?? []),
  ].sort((a, b) => {
    const priorityDifference =
      (priorityOrder[a.priority] ?? 99) -
      (priorityOrder[b.priority] ?? 99);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    if (!a.dueDate && !b.dueDate) {
      return 0;
    }

    if (!a.dueDate) {
      return 1;
    }

    if (!b.dueDate) {
      return -1;
    }

    return (
      new Date(a.dueDate).getTime() -
      new Date(b.dueDate).getTime()
    );
  });

  if (authLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>TaskFlow</h1>
          <p>Project and task management</p>
        </div>

        <div className="user-info">
          {isAdmin && (
            <span>
              Online: {onlineUsers}
            </span>
          )}

          <span>{user.role}</span>

          <div className="notification-wrapper">
            <button
              className="notification-button"
              onClick={() =>
                setShowNotifications(
                  !showNotifications
                )
              }
            >
              Notifications

              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <strong>
                    Notifications
                  </strong>

                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p>No notifications.</p>
                ) : (
                  notifications.map(
                    (notification) => (
                      <div
                        key={notification.id}
                        className={`notification-item ${
                          notification.read
                            ? ""
                            : "unread"
                        }`}
                        onClick={() =>
                          !notification.read &&
                          markNotificationRead(
                            notification.id
                          )
                        }
                      >
                        <p>
                          {
                            notification.message
                          }
                        </p>

                        <small>
                          {new Date(
                            notification.createdAt
                          ).toLocaleString()}
                        </small>
                      </div>
                    )
                  )
                )}
              </div>
            )}
          </div>

          <button onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="section-nav">
        <a href="#dashboard-section">Dashboard</a>
        {canManage && (
          <>
            <a href="#projects-section">Projects</a>
            <a href="#clients-section">Clients</a>
          </>
        )}
        {isAdmin && (
          <a href="#users-section">Users</a>
        )}
      </nav>

      <main className="dashboard">
        {error && (
          <div className="error-banner">
            {error}

            <button
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {!selectedProject && (
          <>
            <div className="page-header" id="dashboard-section">
              <div>
                <h2>Dashboard</h2>
                <p>
                  Welcome back, {user.name}
                </p>
              </div>
            </div>

            {dashboard && (
              <section className="dashboard-summary">
                {user.role === "ADMIN" && (
                  <>
                    <div className="summary-card">
                      <span>
                        Total projects
                      </span>
                      <strong>
                        {dashboard.totalProjects ??
                          0}
                      </strong>
                    </div>

                    <div className="summary-card">
                      <span>
                        Overdue tasks
                      </span>
                      <strong>
                        {dashboard.overdueCount ??
                          0}
                      </strong>
                    </div>

                    <div className="summary-card">
                      <span>
                        Online users
                      </span>
                      <strong>
                        {onlineUsers}
                      </strong>
                    </div>
                  </>
                )}

                {user.role ===
                  "PROJECT_MANAGER" && (
                  <>
                    <div className="summary-card">
                      <span>
                        My projects
                      </span>
                      <strong>
                        {dashboard.projects
                          ?.length ?? 0}
                      </strong>
                    </div>

                    <div className="summary-card">
                      <span>
                        My tasks
                      </span>
                      <strong>
                        {dashboard.projects?.reduce(
                          (total, project) =>
                            total +
                            project._count.tasks,
                          0
                        ) ?? 0}
                      </strong>
                    </div>

                    <div className="summary-card">
                      <span>
                        Due this week
                      </span>
                      <strong>
                        {dashboard
                          .upcomingDueDates
                          ?.length ?? 0}
                      </strong>
                    </div>
                  </>
                )}

                {user.role === "DEVELOPER" && (
                  <>
                    <div className="summary-card">
                      <span>
                        Assigned tasks
                      </span>
                      <strong>
                        {dashboard.tasks
                          ?.length ?? 0}
                      </strong>
                    </div>

                    <div className="summary-card">
                      <span>
                        In progress
                      </span>
                      <strong>
                        {dashboard.tasks?.filter(
                          (task) =>
                            task.status ===
                            "IN_PROGRESS"
                        ).length ?? 0}
                      </strong>
                    </div>

                    <div className="summary-card">
                      <span>
                        Overdue
                      </span>
                      <strong>
                        {dashboard.tasks?.filter(
                          (task) =>
                            task.isOverdue
                        ).length ?? 0}
                      </strong>
                    </div>
                  </>
                )}
              </section>
            )}

            <section className="activity-card">
              <h3>
                {isAdmin
                  ? "Activity Feed (all projects)"
                  : user.role === "PROJECT_MANAGER"
                  ? "Activity Feed (your projects)"
                  : "Activity Feed (your tasks)"}
              </h3>

              {globalActivities.length === 0 ? (
                <p>No recent activity.</p>
              ) : (
                <div className="activity-list">
                  {globalActivities.map(
                    (activity, index) => (
                      <div
                        className="activity-item"
                        key={
                          activity.id ??
                          `${activity.taskId}-${index}`
                        }
                      >
                        {formatActivityLine(activity)}
                        {(activity.project?.name ||
                          activity.projectName) && (
                          <span className="badge">
                            {activity.project?.name ??
                              activity.projectName}
                          </span>
                        )}
                        <small>
                          {" · "}
                          {timeAgo(activity.createdAt)}
                        </small>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            {user.role === "ADMIN" &&
              dashboard && (
                <section className="dashboard-section">
                  <h3>Tasks by status</h3>

                  <div className="stats-list">
                    {dashboard.tasksByStatus?.map(
                      (item) => (
                        <div
                          className="stat-row"
                          key={item.status}
                        >
                          <span>
                            {formatStatus(
                              item.status
                            )}
                          </span>
                          <strong>
                            {item.count}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

            {user.role ===
              "PROJECT_MANAGER" &&
              dashboard && (
                <section className="dashboard-section">
                  <h3>
                    Tasks by priority
                  </h3>

                  <div className="stats-list">
                    {dashboard.tasksByPriority?.map(
                      (item) => (
                        <div
                          className="stat-row"
                          key={item.priority}
                        >
                          <span>
                            {item.priority}
                          </span>
                          <strong>
                            {item.count}
                          </strong>
                        </div>
                      )
                    )}
                  </div>

                  <h3>
                    Upcoming deadlines
                  </h3>

                  <div className="upcoming-list">
                    {dashboard
                      .upcomingDueDates
                      ?.map((task) => (
                        <div
                          className="stat-row"
                          key={task.id}
                        >
                          <span>
                            {task.title}
                          </span>

                          <strong>
                            {new Date(
                              task.dueDate
                            ).toLocaleDateString()}
                          </strong>
                        </div>
                      ))}

                    {dashboard
                      .upcomingDueDates
                      ?.length === 0 && (
                      <p>
                        No upcoming deadlines.
                      </p>
                    )}
                  </div>
                </section>
              )}

            {user.role === "DEVELOPER" &&
              dashboard && (
                <section className="dashboard-section">
                  <h3>
                    My assigned tasks
                  </h3>

                  <div className="task-list">
                    {sortedDeveloperTasks.map(
                      (task) => (
                        <div
                          className="task-card"
                          key={task.id}
                        >
                          <div className="task-main">
                            <div>
                              <h3>
                                {task.title}
                              </h3>

                              <p>
                                {task.project?.name}
                              </p>
                            </div>

                            <div className="task-badges">
                              <span
                                className="badge"
                                data-priority={
                                  task.priority
                                }
                              >
                                {
                                  task.priority
                                }
                              </span>

                              <span
                                className="badge"
                                data-status={
                                  task.status
                                }
                              >
                                {formatStatus(
                                  task.status
                                )}
                              </span>

                              {task.isOverdue && (
                                <span className="overdue">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="task-actions">
                            <select
                              value={task.status}
                              onChange={(event) =>
                                updateTaskStatus(
                                  task.id,
                                  event.target.value
                                )
                              }
                            >
                              {statuses.map(
                                (status) => (
                                  <option
                                    key={status}
                                    value={status}
                                  >
                                    {formatStatus(
                                      status
                                    )}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

            {canManage && (
              <>
                <div className="page-header" id="projects-section">
                  <div>
                    <h2>Projects</h2>
                  </div>

                  <button
                    onClick={() => {
                      resetProjectForm();
                      setShowProjectForm(true);
                    }}
                  >
                    + New Project
                  </button>
                </div>

                {showProjectForm && (
                  <section className="form-card">
                    <h3>
                      {editingProject
                        ? "Edit Project"
                        : "Create Project"}
                    </h3>

                    <input
                      value={projectName}
                      onChange={(event) =>
                        setProjectName(
                          event.target.value
                        )
                      }
                      placeholder="Project name"
                    />

                    <textarea
                      value={
                        projectDescription
                      }
                      onChange={(event) =>
                        setProjectDescription(
                          event.target.value
                        )
                      }
                      placeholder="Description"
                    />

                    <select
                      value={
                        projectClientId
                      }
                      onChange={(event) =>
                        setProjectClientId(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select client
                      </option>

                      {clients.map(
                        (client) => (
                          <option
                            key={client.id}
                            value={client.id}
                          >
                            {client.name}
                            {client.company
                              ? ` — ${client.company}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>

                    <div className="form-actions">
                      <button
                        onClick={
                          editingProject
                            ? updateProject
                            : createProject
                        }
                      >
                        {editingProject
                          ? "Save changes"
                          : "Create"}
                      </button>

                      <button
                        className="secondary-button"
                        onClick={
                          resetProjectForm
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                )}

                {pageLoading && (
                  <p>Loading projects...</p>
                )}

                <div className="project-grid">
                  {projects.map((project) => (
                    <div
                      className="project-card"
                      key={project.id}
                    >
                      <div
                        onClick={() =>
                          openProject(project)
                        }
                      >
                        <h3>
                          {project.name}
                        </h3>

                        <p>
                          {project.description ||
                            "No description"}
                        </p>

                        <div className="project-meta">
                          <span>
                            {pluralize(
                              project._count
                                ?.tasks ?? 0,
                              "task"
                            )}
                          </span>

                          {project.client && (
                            <span>
                              {
                                project.client
                                  .name
                              }
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="task-actions">
                        <button
                          onClick={() =>
                            startEditProject(
                              project
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteProject(
                              project.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {projects.length === 0 &&
                  !pageLoading && (
                    <div className="empty-state">
                      No projects found.
                    </div>
                  )}

                <section className="dashboard-section">
                  <div className="page-header" id="clients-section">
                    <h2>Clients</h2>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          resetClientForm();
                          setShowClientForm(true);
                        }}
                      >
                        + New Client
                      </button>
                    )}
                  </div>

                  {isAdmin && showClientForm && (
                    <div className="form-card">
                      <h3>
                        {editingClient
                          ? "Edit Client"
                          : "Create Client"}
                      </h3>

                      <input
                        value={clientName}
                        onChange={(event) =>
                          setClientName(
                            event.target.value
                          )
                        }
                        placeholder="Client name"
                      />

                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(event) =>
                          setClientEmail(
                            event.target.value
                          )
                        }
                        placeholder="Email"
                      />

                      <input
                        value={clientCompany}
                        onChange={(event) =>
                          setClientCompany(
                            event.target.value
                          )
                        }
                        placeholder="Company"
                      />

                      <div className="form-actions">
                        <button
                          onClick={
                            editingClient
                              ? updateClient
                              : createClient
                          }
                        >
                          {editingClient
                            ? "Save changes"
                            : "Create client"}
                        </button>

                        <button
                          className="secondary-button"
                          onClick={
                            resetClientForm
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="project-grid">
                    {clients.map((client) => (
                      <div
                        className="project-card"
                        key={client.id}
                      >
                        <h3>
                          {client.name}
                        </h3>

                        <p>
                          {client.company ||
                            "No company"}
                        </p>

                        <p>
                          {client.email ||
                            "No email"}
                        </p>

                        <div className="project-meta">
                          <span>
                            {pluralize(
                              client._count
                                ?.projects ?? 0,
                              "project"
                            )}
                          </span>
                        </div>

                        <div className="task-actions">
                          {isAdmin && (
                            <button
                              onClick={() =>
                                startEditClient(
                                  client
                                )
                              }
                            >
                              Edit
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              className="delete-button"
                              onClick={() =>
                                deleteClient(
                                  client.id
                                )
                              }
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {isAdmin && (
                  <section className="dashboard-section">
                    <div
                      className="page-header"
                      id="users-section"
                    >
                      <h2>Users</h2>

                      <button
                        onClick={() => {
                          resetUserForm();
                          setShowUserForm(true);
                        }}
                      >
                        + New User
                      </button>
                    </div>

                    {showUserForm && (
                      <div className="form-card">
                        <h3>Create User</h3>

                        <input
                          placeholder="Full name"
                          value={newUserName}
                          onChange={(event) =>
                            setNewUserName(
                              event.target.value
                            )
                          }
                        />

                        <input
                          placeholder="Email"
                          type="email"
                          value={newUserEmail}
                          onChange={(event) =>
                            setNewUserEmail(
                              event.target.value
                            )
                          }
                        />

                        <input
                          placeholder="Temporary password (min 8 characters)"
                          type="password"
                          value={newUserPassword}
                          onChange={(event) =>
                            setNewUserPassword(
                              event.target.value
                            )
                          }
                        />

                        <select
                          value={newUserRole}
                          onChange={(event) =>
                            setNewUserRole(
                              event.target.value
                            )
                          }
                        >
                          <option value="DEVELOPER">
                            Developer
                          </option>
                          <option value="PROJECT_MANAGER">
                            Project Manager
                          </option>
                          <option value="ADMIN">
                            Admin
                          </option>
                        </select>

                        <div className="form-actions">
                          <button
                            onClick={createManagedUser}
                          >
                            Create
                          </button>

                          <button
                            className="secondary-button"
                            onClick={resetUserForm}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="filter-bar">
                      {(
                        [
                          "ADMIN",
                          "PROJECT_MANAGER",
                          "DEVELOPER",
                        ] as const
                      ).map((role) => {
                        const count = managedUsers.filter(
                          (u) => u.role === role
                        ).length;

                        return (
                          <button
                            key={role}
                            className={
                              usersTab === role
                                ? ""
                                : "secondary-button"
                            }
                            onClick={() =>
                              setUsersTab(role)
                            }
                          >
                            {formatStatus(role)} (
                            {count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="task-list">
                      {managedUsers
                        .filter(
                          (managedUser) =>
                            managedUser.role ===
                            usersTab
                        )
                        .map((managedUser) => (
                        <div
                          className="task-card"
                          key={managedUser.id}
                        >
                          <div className="task-main">
                            <div>
                              <h3>{managedUser.name}</h3>
                              <p>{managedUser.email}</p>
                            </div>

                            <div className="task-badges">
                              <span className="badge">
                                {formatStatus(
                                  managedUser.role
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="task-actions">
                            <button
                              className="delete-button"
                              onClick={() =>
                                deleteManagedUser(
                                  managedUser.id
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {managedUsers.filter(
                      (managedUser) =>
                        managedUser.role === usersTab
                    ).length === 0 && (
                      <div className="empty-state">
                        No{" "}
                        {formatStatus(
                          usersTab
                        ).toLowerCase()}
                        s found.
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {selectedProject && (
          <>
            <div className="page-header">
              <div>
                <h2>
                  {selectedProject.name}
                </h2>

                <p>
                  {selectedProject.description ||
                    "Project tasks"}
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={leaveProject}
              >
                ← Projects
              </button>
            </div>

            <div className="filter-bar">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All statuses
                </option>

                {statuses.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All priorities
                </option>

                {priorities.map(
                  (priority) => (
                    <option
                      key={priority}
                      value={priority}
                    >
                      {priority}
                    </option>
                  )
                )}
              </select>

              <input
                type="date"
                value={fromFilter}
                onChange={(event) =>
                  setFromFilter(
                    event.target.value
                  )
                }
              />

              <input
                type="date"
                value={toFilter}
                onChange={(event) =>
                  setToFilter(
                    event.target.value
                  )
                }
              />

              <button
                onClick={applyFilters}
              >
                Filter
              </button>

              <button
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear
              </button>
            </div>

            {canManage && (
              <div className="action-bar">
                <button
                  onClick={() => {
                    resetTaskForm();
                    setShowTaskForm(true);
                  }}
                >
                  + New Task
                </button>
              </div>
            )}

            {canManage &&
              showTaskForm && (
                <section className="form-card">
                  <h3>
                    {editingTask
                      ? "Edit Task"
                      : "Create Task"}
                  </h3>

                  <input
                    value={taskTitle}
                    onChange={(event) =>
                      setTaskTitle(
                        event.target.value
                      )
                    }
                    placeholder="Task title"
                  />

                  <textarea
                    value={taskDescription}
                    onChange={(event) =>
                      setTaskDescription(
                        event.target.value
                      )
                    }
                    placeholder="Description"
                  />

                  <select
                    value={taskDeveloperId}
                    onChange={(event) =>
                      setTaskDeveloperId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Assign developer
                    </option>

                    {developers.map(
                      (developer) => (
                        <option
                          key={developer.id}
                          value={
                            developer.id
                          }
                        >
                          {developer.name}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(
                        event.target.value
                      )
                    }
                  >
                    {priorities.map(
                      (priority) => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </option>
                      )
                    )}
                  </select>

                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(event) =>
                      setTaskDueDate(
                        event.target.value
                      )
                    }
                  />

                  <div className="form-actions">
                    <button
                      onClick={
                        editingTask
                          ? updateTask
                          : createTask
                      }
                    >
                      {editingTask
                        ? "Save changes"
                        : "Create Task"}
                    </button>

                    <button
                      className="secondary-button"
                      onClick={
                        resetTaskForm
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}

            {pageLoading && (
              <p>Loading tasks...</p>
            )}

            <div className="task-list">
              {tasks.map((task) => (
                <div
                  className="task-card"
                  key={task.id}
                >
                  <div className="task-main">
                    <div>
                      <h3>{task.title}</h3>

                      {task.description && (
                        <p>
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="task-badges">
                      <span
                        className="badge"
                        data-priority={task.priority}
                      >
                        {task.priority}
                      </span>

                      <span
                        className="badge"
                        data-status={task.status}
                      >
                        {formatStatus(
                          task.status
                        )}
                      </span>

                      {task.isOverdue && (
                        <span className="overdue">
                          OVERDUE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="task-details">
                    <span>
                      Developer:{" "}
                      {task.assignedDeveloper
                        ?.name ||
                        "Unknown"}
                    </span>

                    <span>
                      Due:{" "}
                      {task.dueDate
                        ? new Date(
                            task.dueDate
                          ).toLocaleDateString()
                        : "No deadline"}
                    </span>
                  </div>

                  <div className="task-actions">
                    <select
                      value={task.status}
                      onChange={(event) =>
                        updateTaskStatus(
                          task.id,
                          event.target.value
                        )
                      }
                    >
                      {statuses.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {formatStatus(
                              status
                            )}
                          </option>
                        )
                      )}
                    </select>

                    {canManage && (
                      <>
                        <button
                          onClick={() =>
                            startEditTask(
                              task
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteTask(
                              task.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {tasks.length === 0 &&
              !pageLoading && (
                <div className="empty-state">
                  No tasks match the current
                  filters.
                </div>
              )}

            <section className="activity-card">
              <h3>Live Activity</h3>

              {activities.length === 0 ? (
                <p>
                  No recent activity.
                </p>
              ) : (
                <div className="activity-list">
                  {activities.map(
                    (
                      activity,
                      index
                    ) => (
                      <div
                        className="activity-item"
                        key={
                          activity.id ??
                          `${activity.taskId}-${index}`
                        }
                      >
                        {formatActivityLine(activity)}
                        <small>
                          {" · "}
                          {timeAgo(activity.createdAt)}
                        </small>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;