import React, { useState, useMemo } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { formatCurrency, Employee } from '@/data/payrollData';
import { Search, Plus, Edit2, Trash2, Download, X, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';


export const Employees: React.FC = () => {
  const { employees, addEmployee, updateEmployee, uploadEmployeePhoto, deleteEmployee } = usePayroll();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const departments = useMemo(() => Array.from(new Set(employees.map(e => e.department))), [employees]);

  const filtered = employees.filter(e =>
    (e.name.toLowerCase().includes(search.toLowerCase()) ||
     e.id.toLowerCase().includes(search.toLowerCase()) ||
     e.email.toLowerCase().includes(search.toLowerCase())) &&
    (deptFilter === 'All' || e.department === deptFilter) &&
    (statusFilter === 'All' || e.status === statusFilter)
  );

  const [form, setForm] = useState({
    name: '', email: '', idNumber: '', department: 'Engineering', position: 'Officer',
    basicSalary: 50000, allowances: 7500, bankName: 'Equity Bank', bankAccount: '',
    status: 'Active' as Employee['status'], joinDate: new Date().toISOString().split('T')[0],
    avatar: '',
  });

  const openAdd = () => {
    setEditing(null);
    setPhotoFile(null);
    setForm({
      name: '', email: '', idNumber: '', department: 'Engineering', position: 'Officer',
      basicSalary: 50000, allowances: 7500, bankName: 'Equity Bank', bankAccount: '',
      status: 'Active', joinDate: new Date().toISOString().split('T')[0],
      avatar: '',
    });
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setPhotoFile(null);
    setForm({
      name: emp.name, email: emp.email, idNumber: emp.idNumber, department: emp.department,
      position: emp.position, basicSalary: emp.basicSalary, allowances: emp.allowances,
      bankName: emp.bankName, bankAccount: emp.bankAccount, status: emp.status, joinDate: emp.joinDate,
      avatar: emp.avatar || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowModal(false);
    try {
      const { avatar: _avatar, ...employeePayload } = form;
      if (editing) {
        await updateEmployee(editing.id, photoFile ? employeePayload : form);
        if (photoFile) await uploadEmployeePhoto(editing.id, photoFile);
        toast.success('Employee updated');
      } else {
        const employee = await addEmployee({ ...employeePayload, avatar: '' });
        if (employee && photoFile) await uploadEmployeePhoto(employee.id, photoFile);
        toast.success('Employee added');
      }
      setPhotoFile(null);
    } catch (error) {
      toast.error((error as Error).message || 'Unable to save employee');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    await deleteEmployee(id);
    toast.success('Employee deleted');
  };


  const handleExport = () => {
    const csv = [
      ['ID', 'Name', 'Email', 'Department', 'Position', 'Basic Salary', 'Status'].join(','),
      ...filtered.map(e => [e.id, e.name, e.email, e.department, e.position, e.basicSalary, e.status].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees.csv';
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID or email..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
            />
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500">
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500">
            <option value="All">All Status</option>
            <option>Active</option>
            <option>On Leave</option>
            <option>Terminated</option>
          </select>
          <button onClick={handleExport} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAdd} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-500">Showing <span className="font-semibold text-slate-900">{filtered.length}</span> of {employees.length} employees</div>

      {/* Employee table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Department</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Position</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Basic Salary</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 30).map(e => (
                <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setViewing(e)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={e.avatar} alt={e.name} className="w-9 h-9 rounded-full" />
                      <div>
                        <p className="font-medium text-slate-900">{e.name}</p>
                        <p className="text-xs text-slate-500">{e.id} • {e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{e.department}</td>
                  <td className="px-4 py-3 text-slate-700">{e.position}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(e.basicSalary)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      e.status === 'Active' ? 'bg-green-100 text-green-700' :
                      e.status === 'On Leave' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(e)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(e.id, e.name)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 30 && (
          <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500 text-center">
            Showing first 30 of {filtered.length} results
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">{editing ? 'Edit Employee' : 'Add New Employee'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700 mb-1 block">Profile Photo</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100">
                    {form.avatar ? (
                      <img src={form.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No photo</div>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition text-sm">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPhotoFile(file);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setForm(prev => ({ ...prev, avatar: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700 mb-1 block">Full Name</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Email</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">ID Number</label>
                <input required value={form.idNumber} onChange={e => setForm({...form, idNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Department</label>
                <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
                  {['Engineering', 'Finance', 'Human Resources', 'Marketing', 'Operations', 'Sales', 'IT Support', 'Legal'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Position</label>
                <input required value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Basic Salary (KES)</label>
                <input required type="number" value={form.basicSalary} onChange={e => setForm({...form, basicSalary: +e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Allowances (KES)</label>
                <input required type="number" value={form.allowances} onChange={e => setForm({...form, allowances: +e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Bank Name</label>
                <input required value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Bank Account</label>
                <input required value={form.bankAccount} onChange={e => setForm({...form, bankAccount: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
                  <option>Active</option>
                  <option>On Leave</option>
                  <option>Terminated</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Join Date</label>
                <input required type="date" value={form.joinDate} onChange={e => setForm({...form, joinDate: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                  {editing ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee View Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-8 text-white rounded-t-2xl relative">
              <button onClick={() => setViewing(null)} className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <img src={viewing.avatar} alt={viewing.name} className="w-20 h-20 rounded-full border-4 border-white/30" />
                <div>
                  <h3 className="text-2xl font-bold">{viewing.name}</h3>
                  <p className="text-blue-100">{viewing.position}</p>
                  <p className="text-blue-200 text-sm">{viewing.id}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /><span>{viewing.email}</span></div>
                <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /><span>{viewing.department}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-xl p-4">
                <div><p className="text-xs text-slate-500">Basic Salary</p><p className="font-semibold">{formatCurrency(viewing.basicSalary)}</p></div>
                <div><p className="text-xs text-slate-500">Allowances</p><p className="font-semibold">{formatCurrency(viewing.allowances)}</p></div>
                <div><p className="text-xs text-slate-500">Bank</p><p className="font-semibold">{viewing.bankName}</p></div>
                <div><p className="text-xs text-slate-500">Account</p><p className="font-semibold">{viewing.bankAccount}</p></div>
                <div><p className="text-xs text-slate-500">ID Number</p><p className="font-semibold">{viewing.idNumber}</p></div>
                <div><p className="text-xs text-slate-500">Join Date</p><p className="font-semibold">{viewing.joinDate}</p></div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setViewing(null); openEdit(viewing); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Edit Employee</button>
                <button onClick={() => setViewing(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
