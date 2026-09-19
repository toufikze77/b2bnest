
import React from 'react';
import UserDashboard from '@/components/UserDashboard';
import { OperationalOverview } from '@/components/dashboard/OperationalOverview';

const Dashboard = () => {
  return (
    <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <OperationalOverview />
      <section className="border-t border-border pt-8">
        <h2 className="mb-1 text-lg font-semibold">Documents, billing and account</h2>
        <p className="mb-5 text-sm text-muted-foreground">Your purchases, saved templates and account records.</p>
      <UserDashboard />
      </section>
    </div>
  );
};

export default Dashboard;
