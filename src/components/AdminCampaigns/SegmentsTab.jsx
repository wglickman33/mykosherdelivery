import { useState, useEffect } from 'react';
import mailchimpService from '../../services/mailchimpService';
import './AdminCampaigns.scss';

const SegmentsTab = () => {
  const [segments, setSegments] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [segmentForm, setSegmentForm] = useState({
    name: '',
    type: 'static',
    conditions: []
  });

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadSegments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId]);

  const loadLists = async () => {
    try {
      const response = await mailchimpService.getLists();
      if (response.success && response.data.lists) {
        setLists(response.data.lists);
        if (response.data.lists.length > 0) {
          setSelectedListId(response.data.lists[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading lists:', err);
      setError('Failed to load lists');
    }
  };

  const loadSegments = async () => {
    if (!selectedListId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await mailchimpService.getSegments(selectedListId);
      if (response.success && response.data.segments) {
        setSegments(response.data.segments);
      } else {
        setError('Failed to load segments');
      }
    } catch (err) {
      console.error('Error loading segments:', err);
      setError('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSegment = async () => {
    if (!segmentForm.name.trim()) {
      setError('Segment name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const segmentData = {
        name: segmentForm.name,
        type: segmentForm.type,
        staticSegment: segmentForm.type === 'static' ? [] : undefined,
        options: segmentForm.type === 'saved' ? {
          match: 'all',
          conditions: segmentForm.conditions
        } : undefined
      };

      const response = await mailchimpService.createSegment(selectedListId, segmentData);
      
      if (response.success) {
        setShowCreateModal(false);
        setSegmentForm({ name: '', type: 'static', conditions: [] });
        await loadSegments();
      } else {
        setError(response.error || 'Failed to create segment');
      }
    } catch (err) {
      console.error('Error creating segment:', err);
      setError('Failed to create segment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSegment = async (segmentId) => {
    if (!window.confirm('Are you sure you want to delete this segment?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await mailchimpService.deleteSegment(selectedListId, segmentId);
      if (response.success) {
        await loadSegments();
      } else {
        setError('Failed to delete segment');
      }
    } catch (err) {
      console.error('Error deleting segment:', err);
      setError('Failed to delete segment');
    } finally {
      setLoading(false);
    }
  };

  const addCondition = () => {
    setSegmentForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        condition_type: 'TextMerge',
        field: 'FNAME',
        op: 'is',
        value: ''
      }]
    }));
  };

  const updateCondition = (index, field, value) => {
    setSegmentForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) => 
        i === index ? { ...cond, [field]: value } : cond
      )
    }));
  };

  const removeCondition = (index) => {
    setSegmentForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="segments-tab">
      <div className="section-header">
        <h2>Segments</h2>
        <div className="header-actions">
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="list-selector"
          >
            {lists.map(list => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.stats?.member_count || 0} members)
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Segment
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && !segments.length ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading segments...</p>
        </div>
      ) : segments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No segments yet</h3>
          <p>Create segments to target specific groups of customers for your campaigns.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Segment
          </button>
        </div>
      ) : (
        <div className="segments-grid">
          {segments.map((segment) => (
            <div key={segment.id} className="segment-card">
              <div className="segment-header">
                <h3>{segment.name}</h3>
                <span className="segment-type">{segment.type}</span>
              </div>
              <div className="segment-details">
                <p><strong>Members:</strong> {segment.member_count || 0}</p>
                <p><strong>Created:</strong> {new Date(segment.created_at).toLocaleDateString()}</p>
              </div>
              <div className="segment-actions">
                <button 
                  onClick={() => handleDeleteSegment(segment.id)}
                  className="btn btn-sm btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create Segment</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowCreateModal(false);
                  setSegmentForm({ name: '', type: 'static', conditions: [] });
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Segment Name</label>
                <input
                  type="text"
                  value={segmentForm.name}
                  onChange={(e) => setSegmentForm({...segmentForm, name: e.target.value})}
                  placeholder="Enter segment name"
                />
              </div>
              <div className="form-group">
                <label>Segment Type</label>
                <select
                  value={segmentForm.type}
                  onChange={(e) => setSegmentForm({...segmentForm, type: e.target.value})}
                >
                  <option value="static">Static (Manual)</option>
                  <option value="saved">Saved (Dynamic)</option>
                </select>
              </div>
              
              {segmentForm.type === 'saved' && (
                <div className="form-group">
                  <label>Conditions</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addCondition}
                  >
                    Add Condition
                  </button>
                  {segmentForm.conditions.map((condition, index) => (
                    <div key={index} className="condition-row">
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      >
                        <option value="FNAME">First Name</option>
                        <option value="LNAME">Last Name</option>
                        <option value="TOTALSPENT">Total Spent</option>
                        <option value="ORDERCOUNT">Order Count</option>
                        <option value="LASTORDER">Last Order Date</option>
                        <option value="FAVREST">Favorite Restaurant</option>
                      </select>
                      <select
                        value={condition.op}
                        onChange={(e) => updateCondition(index, 'op', e.target.value)}
                      >
                        <option value="is">is</option>
                        <option value="is_not">is not</option>
                        <option value="contains">contains</option>
                        <option value="not_contains">does not contain</option>
                        <option value="starts">starts with</option>
                        <option value="ends">ends with</option>
                        <option value="greater">greater than</option>
                        <option value="less">less than</option>
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeCondition(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setSegmentForm({ name: '', type: 'static', conditions: [] });
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSegment}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Segment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentsTab;

