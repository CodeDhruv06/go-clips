import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Instagram, CheckCircle2, Users } from 'lucide-react';

const InstagramConnect = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.instagram_username || '');
  const [followers, setFollowers] = useState(String(profile?.followers_count || ''));
  const [saving, setSaving] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedUsername = username.trim().replace(/^@/, '');
    if (!trimmedUsername) { toast.error('Enter a username'); return; }

    const count = parseInt(followers);
    if (isNaN(count) || count < 0) { toast.error('Enter a valid follower count'); return; }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        instagram_connected: true,
        instagram_username: trimmedUsername,
        followers_count: count,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to save.');
    } else {
      toast.success('Instagram connected!');
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ instagram_connected: false, instagram_username: null, followers_count: 0 })
      .eq('user_id', user.id);
    toast.success('Instagram disconnected.');
    await refreshProfile();
    setUsername('');
    setFollowers('');
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-accent/10 mb-4">
            <Instagram className="h-8 w-8 text-accent" />
          </div>
          <h1 className="font-display text-2xl font-bold">Connect Instagram</h1>
          <p className="text-muted-foreground text-sm mt-1">Link your account to start submitting reels</p>
        </div>

        {profile?.instagram_connected ? (
          <div className="glass-card p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="font-semibold text-lg">Connected as @{profile.instagram_username}</p>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mt-2">
              <Users className="h-4 w-4" />
              <span>{profile.followers_count.toLocaleString()} followers</span>
            </div>
            {profile.followers_count < 1000 && (
              <p className="text-xs text-warning mt-3">You need at least 1,000 followers to submit reels.</p>
            )}
            <Button variant="outline" className="mt-6" onClick={handleDisconnect} disabled={saving}>
              Disconnect
            </Button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="glass-card p-6 space-y-4">
            <div>
              <Label htmlFor="ig-username">Instagram Username</Label>
              <Input
                id="ig-username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="@yourhandle"
                className="mt-1 bg-secondary border-border"
                required
              />
            </div>
            <div>
              <Label htmlFor="ig-followers">Followers Count</Label>
              <Input
                id="ig-followers"
                type="number"
                value={followers}
                onChange={e => setFollowers(e.target.value)}
                placeholder="15000"
                className="mt-1 bg-secondary border-border"
                required
                min={0}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Connecting...' : 'Connect Instagram'}
            </Button>
          </form>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default InstagramConnect;
