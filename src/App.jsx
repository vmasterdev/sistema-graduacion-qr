import React, { useState, useRef, useEffect } from 'react';
import { Upload, QrCode, UserCheck, Download, Search, Camera, X, Database, FileDown, Users, AlertCircle } from 'lucide-react';

// CONFIGURACIÓN DE FIREBASE
// Reemplaza estos valores con los de tu proyecto Firebase
const FIREBASE_CONFIG = {
  projectId: "sistema-graduacion-qr",
  apiKey: "AIzaSyDUuh5Sv2nvK2Wp52noX0duhuHre7UDA2U"
};

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

// Hook para manejar Firebase con API REST
const useFirebase = () => {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setInitialized(FIREBASE_CONFIG.projectId !== "TU_PROJECT_ID_AQUI");
  }, []);

  const saveToFirestore = async (collectionName, data) => {
    if (!initialized) {
      console.log('Firebase no configurado. Guardando en memoria:', data);
      return { success: true, id: Date.now().toString() };
    }

    try {
      const fields = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (typeof value === 'string') {
          fields[key] = { stringValue: value };
        } else if (typeof value === 'number') {
          fields[key] = { integerValue: value };
        } else if (typeof value === 'boolean') {
          fields[key] = { booleanValue: value };
        } else if (Array.isArray(value)) {
          fields[key] = { arrayValue: { values: value.map(v => ({ stringValue: JSON.stringify(v) })) } };
        } else {
          fields[key] = { stringValue: JSON.stringify(value) };
        }
      });

      const response = await fetch(`${FIRESTORE_URL}/${collectionName}?key=${FIREBASE_CONFIG.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) {
        throw new Error('Error al guardar en Firebase');
      }

      const result = await response.json();
      return { success: true, id: result.name.split('/').pop() };
    } catch (error) {
      console.error('Error guardando en Firestore:', error);
      return { success: false, error };
    }
  };

  const getFromFirestore = async (collectionName) => {
    if (!initialized) {
      return [];
    }

    try {
      const response = await fetch(`${FIRESTORE_URL}/${collectionName}?key=${FIREBASE_CONFIG.apiKey}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener datos de Firebase');
      }

      const result = await response.json();
      
      if (!result.documents) {
        return [];
      }

      return result.documents.map(doc => {
        const data = {};
        Object.keys(doc.fields).forEach(key => {
          const field = doc.fields[key];
          if (field.stringValue !== undefined) {
            try {
              data[key] = JSON.parse(field.stringValue);
            } catch {
              data[key] = field.stringValue;
            }
          } else if (field.integerValue !== undefined) {
            data[key] = parseInt(field.integerValue);
          } else if (field.booleanValue !== undefined) {
            data[key] = field.booleanValue;
          }
        });
        return { id: doc.name.split('/').pop(), ...data };
      });
    } catch (error) {
      console.error('Error obteniendo datos:', error);
      return [];
    }
  };

  return { initialized, saveToFirestore, getFromFirestore };
};

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [students, setStudents] = useState([]);
  const [registeredGuests, setRegisteredGuests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const { initialized, saveToFirestore, getFromFirestore } = useFirebase();

  useEffect(() => {
    if (initialized) {
      loadRegisteredGuests();
    }
  }, [initialized]);

  const loadRegisteredGuests = async () => {
    setLoading(true);
    const data = await getFromFirestore('registered_guests');
    setRegisteredGuests(data);
    setLoading(false);
  };

  const generateQRCode = (data) => {
    const qrData = btoa(JSON.stringify(data));
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(/[,\t;]/));
      
      const processedStudents = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 2 && row[0].trim()) {
          const studentName = row[0].trim();
          const career = row[1].trim();
          const guest1 = row[2]?.trim() || '';
          const guest2 = row[3]?.trim() || '';
          
          const guestsData = [];
          
          if (guest1) {
            const guestData = {
              id: `STD${i}G1${Date.now()}`,
              name: guest1,
              studentName,
              career,
              type: 'Invitado 1',
              qrGenerated: new Date().toISOString()
            };
            guestsData.push(guestData);
            
            if (initialized) {
              await saveToFirestore('guests', guestData);
            }
          }
          
          if (guest2) {
            const guestData = {
              id: `STD${i}G2${Date.now()}`,
              name: guest2,
              studentName,
              career,
              type: 'Invitado 2',
              qrGenerated: new Date().toISOString()
            };
            guestsData.push(guestData);
            
            if (initialized) {
              await saveToFirestore('guests', guestData);
            }
          }
          
          if (guestsData.length > 0) {
            const studentData = {
              name: studentName,
              career,
              guestsCount: guestsData.length,
              uploadedAt: new Date().toISOString()
            };
            processedStudents.push({
              name: studentName,
              career,
              guests: guestsData
            });
            
            if (initialized) {
              await saveToFirestore('students', studentData);
            }
          }
        }
      }
      
      setStudents(processedStudents);
      const message = initialized 
        ? `✓ Cargados ${processedStudents.length} estudiantes con ${processedStudents.reduce((acc, s) => acc + s.guests.length, 0)} invitados y guardados en Firebase`
        : `✓ Cargados ${processedStudents.length} estudiantes con ${processedStudents.reduce((acc, s) => acc + s.guests.length, 0)} invitados (solo en memoria)`;
      alert(message);
      setActiveTab('cards');
    } catch (error) {
      alert('Error al procesar el archivo. Formato esperado: Estudiante, Carrera, Invitado1, Invitado2');
    }
    setLoading(false);
  };

  const downloadCard = async (guest) => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 900, 600);
    gradient.addColorStop(0, '#1e40af');
    gradient.addColorStop(1, '#3b82f6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 600);
    
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 10;
    ctx.strokeRect(25, 25, 850, 550);
    
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.strokeRect(35, 35, 830, 530);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CEREMONIA DE GRADUACIÓN', 450, 90);
    
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 115);
    ctx.lineTo(750, 115);
    ctx.stroke();
    
    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('INVITADO', 450, 165);
    
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(guest.name, 450, 205);
    
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('GRADUANDO', 450, 255);
    
    ctx.font = '28px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(guest.studentName, 450, 290);
    
    ctx.font = 'italic 20px Arial';
    ctx.fillStyle = '#bfdbfe';
    ctx.fillText(guest.career, 450, 320);
    
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = generateQRCode(guest);
    
    await new Promise((resolve) => {
      qrImg.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(325, 360, 250, 250);
        ctx.drawImage(qrImg, 337.5, 372.5, 225, 225);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Presenta este código en el registro', 450, 640);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#bfdbfe';
        ctx.fillText(`ID: ${guest.id}`, 450, 665);
        
        resolve();
      };
    });
    
    const link = document.createElement('a');
    link.download = `Invitacion_${guest.studentName.replace(/\s/g, '_')}_${guest.name.replace(/\s/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadAllCards = async () => {
    const allGuests = students.flatMap(s => s.guests);
    setLoading(true);
    alert(`Descargando ${allGuests.length} tarjetas...`);
    
    for (let i = 0; i < allGuests.length; i++) {
      await downloadCard(allGuests[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setLoading(false);
    alert('✓ Todas las tarjetas descargadas');
  };

  const registerGuest = async (guest) => {
    const existingIndex = registeredGuests.findIndex(r => r.id === guest.id);
    
    if (existingIndex >= 0) {
      alert('⚠️ Este invitado ya fue registrado');
      setSelectedGuest(registeredGuests[existingIndex]);
      return;
    }
    
    const registeredGuest = {
      ...guest,
      registeredAt: new Date().toISOString(),
      registeredTime: new Date().toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'medium'
      })
    };
    
    setLoading(true);
    
    if (initialized) {
      const result = await saveToFirestore('registered_guests', registeredGuest);
      
      if (result.success) {
        setRegisteredGuests([...registeredGuests, registeredGuest]);
        setSelectedGuest(registeredGuest);
        alert('✓ Invitado registrado en Firebase');
      } else {
        alert('❌ Error al registrar');
      }
    } else {
      setRegisteredGuests([...registeredGuests, registeredGuest]);
      setSelectedGuest(registeredGuest);
      alert('✓ Registrado (en memoria)');
    }
    
    setLoading(false);
  };

  const handleManualSearch = () => {
    const allGuests = students.flatMap(s => s.guests);
    const found = allGuests.find(g => 
      g.id.toLowerCase() === searchTerm.toLowerCase() || 
      g.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (found) {
      registerGuest(found);
      setSearchTerm('');
    } else {
      alert('❌ Invitado no encontrado');
    }
  };

  const exportDatabase = () => {
    if (registeredGuests.length === 0) {
      alert('No hay registros para exportar');
      return;
    }

    const headers = ['ID', 'Nombre', 'Tipo', 'Graduando', 'Carrera', 'Fecha/Hora'];
    const rows = registeredGuests.map(g => [
      g.id, g.name, g.type, g.studentName, g.career, g.registeredTime
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Registro_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportGuestList = () => {
    if (students.length === 0) {
      alert('No hay datos');
      return;
    }

    const allGuests = students.flatMap(s => s.guests);
    const headers = ['ID', 'Nombre', 'Tipo', 'Graduando', 'Carrera', 'QR'];
    const rows = allGuests.map(g => [
      g.id, g.name, g.type, g.studentName, g.career, new Date(g.qrGenerated).toLocaleString('es-CO')
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Lista_Invitados_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScannerActive(true);
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara');
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setScannerActive(false);
    }
  };

  const totalGuests = students.reduce((acc, s) => acc + s.guests.length, 0);
  const registrationPercentage = totalGuests > 0 ? ((registeredGuests.length / totalGuests) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-semibold">Procesando...</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {!initialized && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="font-bold text-yellow-900 mb-1">⚠️ Firebase no configurado</h3>
              <p className="text-sm text-yellow-800">Los datos se guardan solo en memoria. Configura Firebase para persistencia.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <QrCode size={40} />
              Sistema de Graduación QR
            </h1>
            <p className="mt-2 text-blue-100">Gestión con código QR y {initialized ? 'Firebase' : 'memoria local'}</p>
          </div>

          <div className="flex border-b bg-gray-50 overflow-x-auto">
            {[
              { id: 'upload', icon: Upload, label: '1. Cargar' },
              { id: 'cards', icon: Download, label: '2. Tarjetas', disabled: students.length === 0 },
              { id: 'register', icon: UserCheck, label: '3. Registro' },
              { id: 'database', icon: Database, label: '4. Base de Datos' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-white text-blue-700 border-b-4 border-blue-700' : 'text-gray-600 hover:bg-gray-100'
                } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <tab.icon size={20} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-8">
            {activeTab === 'upload' && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <Upload className="mx-auto mb-4 text-blue-600" size={64} />
                  <h2 className="text-2xl font-bold mb-2">Cargar Estudiantes e Invitados</h2>
                  <p className="text-gray-600">Los datos se guardarán {initialized ? 'en Firebase' : 'en memoria'}</p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                  <h3 className="font-bold text-blue-900 mb-3">📋 Formato CSV:</h3>
                  <div className="bg-white rounded p-4 font-mono text-sm mb-3 overflow-x-auto">
                    <div className="font-bold text-gray-700 mb-2">Estudiante,Carrera,Invitado1,Invitado2</div>
                    <div className="text-gray-600">Juan Pérez,Ingeniería,María López,Carlos Gómez</div>
                    <div className="text-gray-600">Ana García,Medicina,Pedro Ruiz,Laura Torres</div>
                  </div>
                  <p className="text-sm text-blue-800">✓ Separadores: coma, tabulación o punto y coma</p>
                </div>

                <label className="block">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50"
                  />
                </label>

                {students.length > 0 && (
                  <div className="mt-6 p-6 bg-green-50 border-2 border-green-300 rounded-lg">
                    <h3 className="font-bold text-green-900 mb-3">✓ Datos cargados</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <div className="text-3xl font-bold text-blue-700">{students.length}</div>
                        <div className="text-sm text-gray-600">Estudiantes</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <div className="text-3xl font-bold text-green-700">{totalGuests}</div>
                        <div className="text-sm text-gray-600">Invitados</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cards' && (
              <div>
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Generar Tarjetas</h2>
                    <p className="text-gray-600">Descarga invitaciones con QR</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={exportGuestList}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                    >
                      <FileDown size={18} />
                      Lista
                    </button>
                    <button
                      onClick={downloadAllCards}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Download size={18} />
                      Todas ({totalGuests})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.map((student, idx) => (
                    <div key={idx} className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="bg-blue-50 p-3 rounded-lg mb-3">
                        <h3 className="font-bold text-blue-900">{student.name}</h3>
                        <p className="text-sm text-blue-700">{student.career}</p>
                      </div>
                      
                      {student.guests.map((guest, gIdx) => (
                        <div key={gIdx} className="bg-gray-50 p-3 rounded mb-2 flex justify-between items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{guest.name}</p>
                            <p className="text-xs text-gray-500">{guest.type}</p>
                          </div>
                          <button
                            onClick={() => downloadCard(guest)}
                            disabled={loading}
                            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'register' && (
              <div className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold mb-6 text-center">Registro de Invitados</h2>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-700">{totalGuests}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-700">{registeredGuests.length}</div>
                    <div className="text-sm text-gray-600">Registrados</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-orange-700">{totalGuests - registeredGuests.length}</div>
                    <div className="text-sm text-gray-600">Pendientes</div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Progreso</span>
                    <span className="text-sm font-semibold text-blue-700">{registrationPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-green-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${registrationPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Search size={20} />
                    Búsqueda Manual
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                      placeholder="ID o nombre del invitado..."
                      disabled={loading}
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      onClick={handleManualSearch}
                      disabled={loading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Search size={20} />
                      Buscar
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Camera size={20} />
                    Escanear QR
                  </h3>
                  {!scannerActive ? (
                    <button
                      onClick={startScanner}
                      className="w-full bg-green-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Camera size={24} />
                      Activar Cámara
                    </button>
                  ) : (
                    <div>
                      <video ref={videoRef} className="w-full rounded-lg mb-3" />
                      <button
                        onClick={stopScanner}
                        className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
                      >
                        <X size={20} />
                        Detener
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Para producción: npm install html5-qrcode
                  </p>
                </div>

                {selectedGuest && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-bold text-green-900 text-xl flex items-center gap-2">
                        <UserCheck size={24} />
                        Registrado
                      </h3>
<button onClick={() => setSelectedGuest(null)} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-green-700 font-semibold">Invitado</p>
                        <p className="text-lg font-bold text-green-900">{selectedGuest.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-semibold">Tipo</p>
                        <p className="text-lg font-bold text-green-900">{selectedGuest.type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-semibold">Graduando</p>
                        <p className="text-lg font-bold text-green-900">{selectedGuest.studentName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-semibold">Carrera</p>
                        <p className="text-lg font-bold text-green-900">{selectedGuest.career}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-green-700 font-semibold">Hora de Registro</p>
                        <p className="text-lg font-bold text-green-900">{selectedGuest.registeredTime}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'database' && (
              <div>
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Database size={28} />
                      Base de Datos
                    </h2>
                    <p className="text-gray-600">Registros {initialized ? 'en Firebase' : 'en memoria'}</p>
                  </div>
                  <button
                    onClick={exportDatabase}
                    disabled={registeredGuests.length === 0}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                  >
                    <FileDown size={20} />
                    Exportar CSV
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 rounded-lg">
                    <Users className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{registeredGuests.length}</div>
                    <div className="text-sm opacity-90">Registrados</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-700 text-white p-4 rounded-lg">
                    <UserCheck className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{registrationPercentage}%</div>
                    <div className="text-sm opacity-90">Asistencia</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 rounded-lg">
                    <QrCode className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{totalGuests - registeredGuests.length}</div>
                    <div className="text-sm opacity-90">Pendientes</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white p-4 rounded-lg">
                    <Database className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{[...new Set(registeredGuests.map(g => g.career))].length}</div>
                    <div className="text-sm opacity-90">Carreras</div>
                  </div>
                </div>

                {registeredGuests.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Database className="mx-auto mb-4 text-gray-400" size={64} />
                    <h3 className="text-xl font-bold text-gray-600 mb-2">No hay registros</h3>
                    <p className="text-gray-500">Los invitados registrados aparecerán aquí</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden mb-6">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">#</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invitado</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tipo</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Graduando</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Carrera</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Fecha/Hora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {registeredGuests.map((guest, idx) => (
                              <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-gray-600">{idx + 1}</td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-gray-900">{guest.name}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {guest.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">{guest.studentName}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{guest.career}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{guest.registeredTime}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold mb-4">Resumen por Carrera</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...new Set(registeredGuests.map(g => g.career))].map((career, idx) => {
                          const careerGuests = registeredGuests.filter(g => g.career === career);
                          const careerTotal = students
                            .filter(s => s.career === career)
                            .reduce((acc, s) => acc + s.guests.length, 0);
                          const careerPercentage = careerTotal > 0 ? ((careerGuests.length / careerTotal) * 100).toFixed(1) : 0;
                          
                          return (
                            <div key={idx} className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                              <h4 className="font-bold text-blue-900 mb-2">{career}</h4>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-2xl font-bold text-blue-700">{careerGuests.length}</span>
                                <span className="text-sm text-gray-600">de {careerTotal}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${careerPercentage}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-600 mt-1 text-right">{careerPercentage}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-gray-600 text-sm pb-4">
          <p>Sistema de Graduación con QR y Firebase</p>
          <p className="text-xs mt-1">Gestión en tiempo real de invitados</p>
        </div>
      </div>
    </div>
  );
}

export default App;