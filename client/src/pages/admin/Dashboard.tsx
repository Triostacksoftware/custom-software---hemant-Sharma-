import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalGroups: 0,
    activeGroups: 0,
    draftGroups: 0,
    totalMembers: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // temporary mock data
    setTimeout(() => {
      setStats({
        totalGroups: 12,
        activeGroups: 7,
        draftGroups: 5,
        totalMembers: 86
      });
      setLoading(false);
    }, 600);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("role");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] text-gray-400">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white p-8">

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm">
            System overview & management
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-200 transition"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">

        <StatCard
          title="Total Groups"
          value={stats.totalGroups}
        />

        <StatCard
          title="Active Groups"
          value={stats.activeGroups}
          accent="green"
        />

        <StatCard
          title="Draft Groups"
          value={stats.draftGroups}
          accent="yellow"
        />

        <StatCard
          title="Total Members"
          value={stats.totalMembers}
          accent="blue"
        />

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <ActionCard
          title="Create New Group"
          description="Initialize a new group in draft state"
          onClick={() => navigate("/admin/groups/create")}
        />

        <ActionCard
          title="Manage Groups"
          description="Add members, activate or monitor groups"
          onClick={() => navigate("/admin/groups")}
        />

        <ActionCard
          title="Manage Users"
          description="View and approve registered users"
          onClick={() => navigate("/admin/users")}
        />

      </div>
    </div>
  );
};


const StatCard = ({ title, value, accent }) => {
  const accentMap = {
    green: "border-green-500/30 text-green-400",
    yellow: "border-yellow-500/30 text-yellow-400",
    blue: "border-blue-500/30 text-blue-400"
  };

  return (
    <div className={`p-6 rounded-2xl bg-[#121214] border border-white/10 ${accent ? accentMap[accent] : ""}`}>
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
};

const ActionCard = ({ title, description, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-6 rounded-2xl bg-[#121214] border border-white/10 text-left hover:border-white/30 transition"
    >
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </button>
  );
};

export default AdminDashboard;
