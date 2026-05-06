import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// === Context & Protections ===
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, EmployeeRoute } from './routes';
import MemberRoute from './routes/MemberRoute';

// === Layout Components ===
import AdminLayout from './components/layout/AdminLayout';
import EmployeeLayout from './components/layout/EmployeeLayout';
import MemberLayout from './components/layout/MemberLayout';

// === Public Pages ===
import LandingPage from './pages/public/LandingPage';

// === Admin Pages ===
import Dashboard from './pages/admin/Dashboard';
import Members from './pages/admin/Members';
import MemberDetails from './pages/admin/MemberDetails';
import Groups from './pages/admin/Groups';
import CreateGroup from './pages/admin/CreateGroup';
import GroupDetails from './pages/admin/GroupDetails';
import Employees from './pages/admin/Employees';
import Approvals from './pages/admin/Approvals';
import Collections from './pages/admin/Collections';
import Payouts from './pages/admin/Payouts';
import Advertisement from './pages/admin/Advertisement';
import BiddingHub from './pages/admin/Bidding';
import BiddingRoom from './pages/admin/BiddingRoom';

// === Employee Pages ===
import EmployeeDashboard from './pages/employee/Dashboard';
import LogContribution from './pages/employee/LogContribution';
import TransactionHistory from './pages/employee/TransactionHistory';
import CashTransfers from './pages/employee/CashTransfers';

// === Member Pages ===
import MemberDashboard from './pages/member/Dashboard';
import GroupsMembers from './pages/member/Groups';
import MemberGroupDetails from './pages/member/GroupDetails';
import RaiseRequest from './pages/member/RaiseRequest';
import Transactions from './pages/member/Transactions';
import Bidding from './pages/member/Bidding';
import MemberBiddingRoom from './pages/member/BiddingRoom'; //

// === Global Styles ===
import './App.css';


function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    <Routes>

                        {/* ==========================================
                            PUBLIC ROUTES
                        ========================================== */}
                        <Route path="/" element={<LandingPage />} />


                        {/* ==========================================
                            ADMIN ROUTES
                        ========================================== */}
                        <Route path="/admin/dashboard" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Dashboard />
                                </AdminLayout>
                            </AdminRoute>
                        } />

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

                        <Route path="/admin/create-group" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <CreateGroup />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/collections" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Collections />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/payouts" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Payouts />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/bidding" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <BiddingHub />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/bidding/room/:groupId" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <BiddingRoom />
                                </AdminLayout>
                            </AdminRoute>
                        } />

                        <Route path="/admin/advertisement" element={
                            <AdminRoute>
                                <AdminLayout>
                                    <Advertisement />
                                </AdminLayout>
                            </AdminRoute>
                        } />


                        {/* ==========================================
                            EMPLOYEE ROUTES
                        ========================================== */}
                        <Route path="/employee/dashboard" element={
                            <EmployeeRoute allowedRoles={['employee']}>
                                <EmployeeLayout>
                                    <EmployeeDashboard />
                                </EmployeeLayout>
                            </EmployeeRoute>
                        } />

                        <Route path="/employee/log-contribution" element={
                            <EmployeeRoute allowedRoles={['employee']}>
                                <EmployeeLayout>
                                    <LogContribution />
                                </EmployeeLayout>
                            </EmployeeRoute>
                        } />

                        <Route path="/employee/history" element={
                            <EmployeeRoute>
                                <EmployeeLayout>
                                    <TransactionHistory />
                                </EmployeeLayout>
                            </EmployeeRoute>
                        } />

                        <Route path="/employee/cash-transfers" element={
                            <EmployeeRoute>
                                <EmployeeLayout>
                                    <CashTransfers />
                                </EmployeeLayout>
                            </EmployeeRoute>
                        } />


                        {/* ==========================================
                            MEMBER / USER ROUTES
                        ========================================== */}
                        <Route path="/user/dashboard" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <MemberDashboard />
                                </MemberLayout>
                            </MemberRoute>
                        } />

                        <Route path="/user/groups" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <GroupsMembers />
                                </MemberLayout>
                            </MemberRoute>
                        } />

                        <Route path="/user/group/:groupId" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <MemberGroupDetails />
                                </MemberLayout>
                            </MemberRoute>
                        } />

                        <Route path="/user/raise-request" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <RaiseRequest />
                                </MemberLayout>
                            </MemberRoute>
                        } />

                        <Route path="/user/transactions" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <Transactions />
                                </MemberLayout>
                            </MemberRoute>
                        } />

                        <Route path="/user/bidding" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <Bidding />
                                </MemberLayout>
                            </MemberRoute>
                        } />

                        {/* NEW ROUTE ADDED: Member Bidding Room */}
                        <Route path="/user/bidding/room/:roundId" element={
                            <MemberRoute>
                                <MemberLayout>
                                    <MemberBiddingRoom />
                                </MemberLayout>
                            </MemberRoute>
                        } />


                        {/* ==========================================
                            FALLBACK ROUTE
                        ========================================== */}
                        <Route path="*" element={<Navigate to="/" replace />} />

                    </Routes>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;