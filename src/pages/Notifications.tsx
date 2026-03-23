import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Notification = Tables<'notifications'>;

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setNotifications(data);
        setLoading(false);
      });

    supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false).then(() => {});
  }, [user]);

  return (
    <DashboardLayout>
      <h1 className="font-display text-xl font-bold mb-5">Notifications</h1>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass-card p-4 ${!n.read ? 'border-l-2 border-l-primary' : ''}`}
            >
              <p className="text-sm">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Notifications;
