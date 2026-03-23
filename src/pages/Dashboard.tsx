import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Campaign = Tables<'campaigns'>;

const categoryColors: Record<string, string> = {
  Sports: 'bg-info/20 text-info',
  General: 'bg-success/20 text-success',
  Gambling: 'bg-warning/20 text-warning',
};

const Dashboard = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });

  useEffect(() => {
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setCampaigns(data);
    });

    if (user) {
      supabase.from('submissions').select('status').eq('user_id', user.id).then(({ data }) => {
        if (data) {
          setStats({
            total: data.length,
            approved: data.filter(s => s.status === 'Approved').length,
            rejected: data.filter(s => s.status === 'Rejected').length,
            pending: data.filter(s => s.status === 'Pending').length,
          });
        }
      });
    }
  }, [user]);

  const statCards = [
    { label: 'Total Submissions', value: stats.total, icon: Eye, color: 'text-primary' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-success' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-destructive' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-warning' },
  ];

  return (
    <DashboardLayout>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="font-display text-2xl font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <h2 className="font-display text-2xl font-bold mb-6">Active Campaigns</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign, i) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="glass-card p-6 flex flex-col group hover:glow-border transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge className={categoryColors[campaign.category] || 'bg-secondary text-secondary-foreground'}>
                {campaign.category}
              </Badge>
              <Badge variant={campaign.status === 'Active' ? 'default' : 'secondary'}>
                {campaign.status}
              </Badge>
              {campaign.reward_per_million_views >= 300 && (
                <Badge className="bg-accent/20 text-accent">High Paying</Badge>
              )}
            </div>

            <h3 className="font-display text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
              {campaign.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
              {campaign.description}
            </p>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-semibold">${campaign.reward_per_million_views} / 1M views</span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={`/campaign/${campaign.id}`}>View Details</Link>
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
