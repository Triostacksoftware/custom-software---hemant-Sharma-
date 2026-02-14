import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute } from './routes';
import LandingPage from './pages/public/LandingPage';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Members from './pages/admin/Members';
import Groups from './pages/admin/Groups';
import Employees from './pages/admin/Employees';
import Approvals from './pages/admin/Approvals';
import CreateGroup from './pages/admin/CreateGroup';
import GroupDetails from './pages/admin/GroupDetails';
import MemberDetails from './pages/admin/MemberDetails';

import './App.css';

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<LandingPage />} />

                        {/* Admin Routes */}
                        <Route path="/admin/dashboard" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Dashboard />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        {/* Placeholder for other admin routes */}
                        <Route path="/admin/approvals" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Approvals />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/members" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Members />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/member/:userId" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <MemberDetails />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/employees" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Employees />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/groups" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Groups />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/group/:groupId" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <GroupDetails />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        {/* <Route path="/admin/groups" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <div>Groups Page - Coming Soon</div>
                                </AdminLayout>
                            </AdminRoute>
                        } /> */}

                        <Route path="/admin/create-group" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <CreateGroup />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        {/* Employee Routes (Placeholder) */}
                        <Route path="/employee/dashboard" element={
                            <div>Employee Dashboard - Coming Soon</div>
                        } />

                        {/* User Routes (Placeholder) */}
                        <Route path="/user/dashboard" element={
                            <div>User Dashboard - Coming Soon</div>
                        } />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;