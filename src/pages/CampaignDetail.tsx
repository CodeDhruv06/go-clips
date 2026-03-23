import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Campaign = Tables<'campaigns'>;

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [reelUrl, setReelUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    if (id) {
      supabase.from('campaigns').select('*').eq('id', id).single().then(({ data }) => {
        setCampaign(data);
      });
    }
  }, [id]);

  const validateReelUrl = (url: string) => {
    return /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/i.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !campaign) return;

    if (!profile?.instagram_connected || (profile?.followers_count ?? 0) < 1000) {
      toast.error('You need at least 1,000 Instagram followers to submit. Connect your Instagram first.');
      return;
    }

    if (campaign.status !== 'Active') {
      toast.error('This campaign is no longer active.');
      return;
    }

    if (!validateReelUrl(reelUrl)) {
      toast.error('Please enter a valid Instagram Reel URL.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('submissions').insert({
      user_id: user.id,
      campaign_id: campaign.id,
      reel_url: reelUrl.trim(),
    });

    if (error) {
      toast.error('Failed to submit reel.');
    } else {
      toast.success('Reel submitted successfully!');
      setReelUrl('');
      setShowSubmit(false);
    }
    setSubmitting(false);
  };

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const canSubmit = profile?.instagram_connected && (profile?.followers_count ?? 0) >= 1000 && campaign.status === 'Active';

  return (
    <DashboardLayout>
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
        <div className="glass-card p-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className={campaign.category === 'Sports' ? 'bg-info/20 text-info' : campaign.category === 'Gambling' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}>
              {campaign.category}
            </Badge>
            <Badge variant={campaign.status === 'Active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
            {campaign.reward_per_million_views >= 300 && <Badge className="bg-accent/20 text-accent">High Paying</Badge>}
          </div>

          <h1 className="font-display text-3xl font-bold mb-4">{campaign.title}</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">{campaign.description}</p>

          <div className="flex items-center gap-2 text-primary mb-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <TrendingUp className="h-5 w-5" />
            <span className="font-display text-lg font-semibold">${campaign.reward_per_million_views} per 1M views</span>
          </div>

          {/* Rules */}
          <h2 className="font-display text-xl font-semibold mb-4">Campaign Rules</h2>
          <div className="space-y-3 mb-8">
            {campaign.rules?.map((rule, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span className="text-secondary-foreground">{rule}</span>
              </div>
            ))}
          </div>

          {/* Eligibility warning */}
          {!canSubmit && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20 mb-6">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                {!profile?.instagram_connected
                  ? 'Connect your Instagram account to submit reels.'
                  : (profile?.followers_count ?? 0) < 1000
                  ? 'You need at least 1,000 followers to participate.'
                  : 'This campaign is closed.'}
              </div>
            </div>
          )}

          {/* Submit section */}
          {!showSubmit ? (
            <Button onClick={() => setShowSubmit(true)} disabled={!canSubmit} className="w-full sm:w-auto">
              Submit Reel
            </Button>
          ) : (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleSubmit}
              className="space-y-4 p-4 rounded-lg bg-secondary border border-border"
            >
              <div>
                <Label htmlFor="reel-url">Instagram Reel URL</Label>
                <Input
                  id="reel-url"
                  value={reelUrl}
                  onChange={e => setReelUrl(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className="mt-1 bg-background border-border"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Paste a valid Instagram Reel URL</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowSubmit(false)}>Cancel</Button>
              </div>
            </motion.form>
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default CampaignDetail;
