'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Save, X, Trash2, Mail, Shield } from 'lucide-react';

type Profile = {
  id: string;
  email?: string;
  role?: string;
};

type Organization = {
  id: string;
  name: string;
  profiles?: Profile[];
};

export default function OrganizationAdministrators({ org, onUpdate }: { org: Organization; onUpdate?: () => void }) {
  const [admins, setAdmins] = useState<Profile[]>(org.profiles || []);
  const [adding, setAdding] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', role: 'ministry_admin' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const roleOptions = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'ministry_admin', label: 'Ministry Admin' },
    { value: 'department_head', label: 'Department Head' },
    { value: 'asset_officer', label: 'Asset Officer' },
  ];

  const handleAddAdmin = async () => {
    if (!newAdmin.email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(newAdmin.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newAdmin.email,
          role: newAdmin.role,
          organization_id: org.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add administrator');
      }

      const data = await response.json();
      setAdmins([...admins, data.profile]);
      setNewAdmin({ email: '', role: 'ministry_admin' });
      setAdding(false);
      toast.success('Administrator added successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add administrator');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to remove this administrator?')) return;

    setDeleting(adminId);
    try {
      const response = await fetch(`/api/admin/profiles/${adminId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete administrator');
      }

      setAdmins(admins.filter(a => a.id !== adminId));
      toast.success('Administrator removed successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove administrator');
    } finally {
      setDeleting(null);
    }
  };

  const getRoleLabel = (role?: string) => {
    return roleOptions.find(r => r.value === role)?.label || role || 'Unknown';
  };

  const getRoleColor = (role?: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-rose-500/10 text-rose-500',
      ministry_admin: 'bg-sky-500/10 text-sky-500',
      department_head: 'bg-violet-500/10 text-violet-400',
      asset_officer: 'bg-amber-500/10 text-amber-600',
    };
    return colors[role || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Current Administrators */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Current Administrators</h3>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Administrator
            </Button>
          )}
        </div>

        {admins.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No administrators assigned yet</p>
        ) : (
          <div className="space-y-3">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {admin.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {admin.email}
                    </p>
                    <Badge className={getRoleColor(admin.role)}>
                      <Shield className="w-3 h-3 mr-1" />
                      {getRoleLabel(admin.role)}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAdmin(admin.id)}
                  disabled={deleting === admin.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Administrator Form */}
      {adding && (
        <Card className="border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Add New Administrator</h3>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={newAdmin.email}
                onChange={e => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-role">Role</Label>
              <Select value={newAdmin.role} onValueChange={(value) => setNewAdmin((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger id="admin-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAddAdmin} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Adding...' : 'Add Administrator'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
