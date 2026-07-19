import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Megaphone, Gift, FileText, Plus, Trash2, Send, Paperclip, UploadCloud } from 'lucide-react';

export default function AnnouncementsManagement() {
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('announcement'); // 'announcement', 'birthday', 'document'
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'content_reports', 'data', 'announcements'), (snapshot) => {
      const anns = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      anns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAnnouncements(anns);
    });

    return () => unsub();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'announcements'), {
        title: title.trim(),
        message: message.trim(),
        type,
        fileUrl,
        createdAt: new Date().toISOString()
      });

      setTitle('');
      setMessage('');
      setType('announcement');
      setFileUrl('');
      alert('Announcement published successfully.');
    } catch (err) {
      console.error('Create announcement error:', err);
      alert('Failed to publish announcement.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id, titleStr) => {
    if (window.confirm(`Delete announcement "${titleStr}"?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'announcements', id));
      } catch (err) {
        console.error('Delete announcement error:', err);
        alert('Failed to delete announcement.');
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Birthday Wishes & Document Sharing
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Share birthday messages, general notices, or attach documents/files for all employees to see on their dashboards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CREATE FORM */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Megaphone className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">New Broadcast</h2>
              <p className="text-xs text-slate-500 mt-1">Post notices or documents</p>
            </div>
          </div>

          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Broadcast Type
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setType('announcement')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                    type === 'announcement' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Megaphone className="h-3.5 w-3.5 mb-0.5" />
                  <span>Notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('birthday')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                    type === 'birthday' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Gift className="h-3.5 w-3.5 mb-0.5" />
                  <span>Birthday</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('document')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                    type === 'document' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 mb-0.5" />
                  <span>Document</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Title / Subject
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === 'birthday' ? 'e.g., Happy Birthday Anjali!' :
                  type === 'document' ? 'e.g., Company Policy Handbook 2026' :
                  'e.g., Important Team Meeting Tomorrow'
                }
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Message Content
              </label>
              <textarea
                required
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement or birthday wish message here..."
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Optional Document Upload or File Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Attach File or Document
              </label>
              <input
                type="file"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              {fileUrl && (
                <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ File attached successfully</span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>Publish Broadcast</span>
            </button>
          </form>
        </div>

        {/* LIST OF ANNOUNCEMENTS */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Published Broadcasts ({announcements.length})</h2>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
              No broadcasts published yet.
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div 
                  key={ann.id}
                  className={`p-5 rounded-2xl border transition duration-150 flex flex-col justify-between space-y-3 ${
                    ann.type === 'birthday' 
                      ? 'bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200' 
                      : ann.type === 'document'
                      ? 'bg-gradient-to-br from-indigo-50 to-slate-50 border-indigo-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {ann.type === 'birthday' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-100 text-pink-700 border border-pink-200">
                            <Gift className="h-3 w-3 mr-1 text-pink-600" /> Birthday Wish
                          </span>
                        )}
                        {ann.type === 'document' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            <FileText className="h-3 w-3 mr-1 text-indigo-600" /> Shared Document
                          </span>
                        )}
                        {ann.type === 'announcement' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                            <Megaphone className="h-3 w-3 mr-1 text-amber-600" /> Notice
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-400">
                          {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900">{ann.title}</h3>
                    </div>

                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                      className="p-1.5 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 text-slate-400 rounded-lg transition cursor-pointer shadow-xs"
                      title="Delete Announcement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{ann.message}</p>

                  {ann.fileUrl && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <a
                        href={ann.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center space-x-1 text-xs text-indigo-700 font-bold hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>View / Download Attachment</span>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
