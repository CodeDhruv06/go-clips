import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Submission = Tables<'submissions'> & { campaigns?: { title: string } | null };

const statusColors: Record<string, string> = {
  Pending: 'bg-warning/20 text-warning',
  Approved: 'bg-success/20 text-success',
  Rejected: 'bg-destructive/20 text-destructive',
  Flagged: 'bg-accent/20 text-accent',
};

const Submissions = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCampaign, setFilterCampaign] = useState('all');
  const [filterDate, setFilterDate] = useState('all');

  useEffect(() => {
    if (!user) return;

    supabase
      .from('submissions')
      .select('*, campaigns(title)')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSubmissions(data as Submission[]);
      });

    supabase.from('campaigns').select('id, title').then(({ data }) => {
      if (data) setCampaigns(data);
    });
  }, [user]);

  const filtered = submissions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (filterCampaign !== 'all' && s.campaign_id !== filterCampaign) return false;
    if (filterDate !== 'all') {
      const days = filterDate === '7' ? 7 : 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(s.submitted_at) < cutoff) return false;
    }
    return true;
  });

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold mb-6">My Submissions</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-secondary border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[200px] bg-secondary border-border">
            <SelectValue placeholder="Campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDate} onValueChange={setFilterDate}>
          <SelectTrigger className="w-[150px] bg-secondary border-border">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No submissions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub, i) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{sub.campaigns?.title || 'Unknown Campaign'}</p>
                <a
                  href={sub.reel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  View Reel <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Badge className={statusColors[sub.status] || ''}>{sub.status}</Badge>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(sub.submitted_at).toLocaleDateString()}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Submissions;
