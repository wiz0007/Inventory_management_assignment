import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { ItemsPage } from '../pages/ItemsPage';
import { LocationsPage } from '../pages/LocationsPage';
import { MovementsPage } from '../pages/MovementsPage';
import { ImportExportPage } from '../pages/ImportExportPage';
import { AlertsPage } from '../pages/AlertsPage';

interface AllRoutesProps {
  onRefreshBadge?: () => void;
}

export const AllRoutes: React.FC<AllRoutesProps> = ({ onRefreshBadge }) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <DashboardPage
            onNavigateToItems={() => navigate('/items')}
            onNavigateToAlerts={() => navigate('/alerts')}
            onNavigateToMovements={() => navigate('/movements')}
            onNavigateToLocations={() => navigate('/locations')}
          />
        }
      />
      <Route path="/items" element={<ItemsPage />} />
      <Route path="/locations" element={<LocationsPage />} />
      <Route path="/movements" element={<MovementsPage />} />
      <Route path="/import-export" element={<ImportExportPage />} />
      <Route
        path="/alerts"
        element={
          <AlertsPage 
            onNavigateToMovements={() => navigate('/movements')} 
            onRefreshBadge={onRefreshBadge} 
          />
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AllRoutes;
