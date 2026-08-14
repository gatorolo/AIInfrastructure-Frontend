import { Component, OnInit, OnDestroy } from '@angular/core';
import { UsuarioService } from './usuario.service';
import { ChatService } from './chat.service';
import { DashboardService } from './dashboard.service';
import Swal from 'sweetalert2';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'ai-infrastructure-frontend';
  userEmail: string = '';
  isBackendOnline: boolean = true;
  private healthCheckInterval: any;
  dashboardData: any = null; // Para guardar la data del backend
  activeModal: string | null = null;
  activeDashboardTab: string = 'overview';
  isAdmin: boolean = false;
  isVerified: boolean = false;
  
  // Variables de Outreach
  outreachFile: File | null = null;
  outreachCampanaNombre: string = '';
  isUploadingCsv: boolean = false;
  adminLeads: any[] = [];
  selectedLead: any = null;

  // Variables de Reservar Llamada (Booking)
  bookingEmail: string = '';
  selectedDay: number | null = null;
  selectedSlot: string | null = null;
  bookingSuccess: boolean = false;
  
  // Variables de la calculadora
  calcSpend: number | null = null;
  calcIdle: number | null = null;
  calcResult: number | null = null;
  calcTollEmail: string = '';
  isCalculatorTollActive: boolean = false;
  isRevealingImpact: boolean = false;

  // Benchmark Variables
  benchQ1: string = '';
  benchQ2: string = '';
  benchQ3: string = '';
  isBenchmarkLoading: boolean = false;
  benchmarkPdfUrl: string | null = null;
  
  // Chat Variables
  isChatOpen: boolean = false;
  chatInput: string = '';
  chatMessages: {text: string, isBot: boolean}[] = [
    { text: 'Hello! I am your AI Infrastructure Assistant. How can I help you today?', isBot: true }
  ];
  isChatLoading: boolean = false;
  isSendingAccessEmail: boolean = false;

  // Accesibilidad: Lupa
  zoomActivo: boolean = false;
  private lensElement: HTMLElement | null = null;
  private clonedContent: HTMLElement | null = null;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private clickCloseListener: ((e: MouseEvent) => void) | null = null;
  public zoomScale: number = 2.0;
  public lensSize: number = 250;

  constructor(
    private usuarioService: UsuarioService,
    private chatService: ChatService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
    // 0. Iniciar monitoreo del Backend en segundo plano
    this.checkBackendHealth();
    this.healthCheckInterval = setInterval(() => {
      this.checkBackendHealth();
    }, 5000); // Monitorear cada 5 segundos

    // 1. Cargar estado de sesión persistido en el navegador
    const savedEmail = localStorage.getItem('userEmail');
    const savedVerified = localStorage.getItem('isVerified') === 'true';
    const savedUsuarioId = localStorage.getItem('usuarioId');

    if (savedEmail && savedVerified) {
      this.userEmail = savedEmail;
      this.isVerified = true;
      if (savedUsuarioId) {
        this.dashboardService.getDashboardData(Number(savedUsuarioId)).subscribe({
          next: (dashData) => {
            this.handleDashboardData(dashData);
          },
          error: (err) => console.error('Error cargando datos de sesión guardada:', err)
        });
      }
    }

    // 2. Check for ?token= (User Activation) or ?userId= (Outreach Invite)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');

    if (token) {
      // Intentar validar token
      fetch(`${environment.apiUrl}/auth/verify?token=${token}`)
        .then(res => {
          if (!res.ok) throw new Error('Token inválido');
          return res.json();
        })
        .then(data => {
          this.userEmail = data.email;
          this.isVerified = true;

          // Guardar sesión en LocalStorage
          localStorage.setItem('userEmail', data.email);
          localStorage.setItem('isVerified', 'true');
          if (data.usuarioId) {
            localStorage.setItem('usuarioId', String(data.usuarioId));
          }

          Swal.fire('¡Cuenta Activada!', 'Tu acceso ha sido verificado con éxito.', 'success');
          
          if (data.usuarioId) {
            this.dashboardService.getDashboardData(data.usuarioId).subscribe({
              next: (dashData) => {
                this.handleDashboardData(dashData);
              },
              error: (err) => console.error(err)
            });
          }
        })
        .catch(err => {
          console.error(err);
          Swal.fire('Error', 'El enlace es inválido o ha expirado.', 'error');
        });
    } else if (userId) {
      // Outreach Flow
      this.dashboardService.getDashboardData(Number(userId)).subscribe({
        next: (dashData) => {
          this.handleDashboardData(dashData);
          if (dashData.email) {
            this.userEmail = dashData.email;
            this.isVerified = true;
            
            // Guardar sesión
            localStorage.setItem('userEmail', dashData.email);
            localStorage.setItem('isVerified', 'true');
            localStorage.setItem('usuarioId', String(userId));
          }
        },
        error: (err) => {
          console.error('Error al cargar dashboard desde el enlace del correo', err);
        }
      });
    }
  }

  async loginAdmin(event: Event) {
    event.preventDefault();
    const { value: formValues } = await Swal.fire({
      title: 'Admin Login',
      html:
        '<input id="swal-input1" class="swal2-input" placeholder="Username">' +
        '<input id="swal-input2" class="swal2-input" type="password" placeholder="Password">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Login',
      confirmButtonColor: '#22c55e',
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value
        ]
      }
    });

    if (formValues) {
      const [username, password] = formValues;
      if (username === 'admin' && password === 'random') {
        this.isAdmin = true;
        this.isVerified = true;
        this.setDashboardTab('leads');
        
        // Scroll to dashboard
        document.querySelector('.dashboard-section')?.scrollIntoView({ behavior: 'smooth' });
        
        Swal.fire({
          title: 'Acceso Concedido',
          text: 'Bienvenido al panel de administrador.',
          icon: 'success',
          confirmButtonColor: '#22c55e'
        });
      } else {
        Swal.fire('Error', 'Credenciales incorrectas.', 'error');
      }
    }
  }

  openModal(modalName: string, event: Event) {
    event.preventDefault();
    this.activeModal = modalName;
  }

  closeModal() {
    this.activeModal = null;
    this.bookingSuccess = false;
    this.selectedDay = null;
    this.selectedSlot = null;
    this.bookingEmail = '';
  }

  selectDay(day: number) {
    this.selectedDay = day;
    this.bookingSuccess = false;
  }

  selectSlot(slot: string) {
    this.selectedSlot = slot;
    this.bookingSuccess = false;
  }

  confirmBooking() {
    if (!this.bookingEmail || !this.selectedDay || !this.selectedSlot) return;

    fetch(`${environment.apiUrl}/auth/schedule-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: this.bookingEmail,
        day: this.selectedDay.toString(),
        slot: this.selectedSlot
      })
    })
    .then(res => {
      if (res.ok) {
        this.bookingSuccess = true;
      } else {
        res.json().then(data => {
          alert(data.mensaje || 'Error scheduling call');
        });
      }
    })
    .catch(err => {
      console.error(err);
      alert('Error connecting to the server');
    });
  }

  verDetalleLead(lead: any) {
    this.selectedLead = lead;
    this.activeModal = 'lead_detail';
  }

  setDashboardTab(tabName: string) {
    this.activeDashboardTab = tabName;
    if (tabName === 'leads' && this.isAdmin) {
      this.loadAdminLeads();
    }
  }

  calculateImpact() {
    if (this.calcSpend && this.calcIdle) {
      // Cálculo matemático real
      this.calcResult = this.calcSpend * (this.calcIdle / 100);
      
      if (this.isVerified || this.isAdmin) {
        // Bypass toll and just save metrics
        this.isCalculatorTollActive = false;
        if (this.userEmail) {
          fetch(`${environment.apiUrl}/calculadora/guardar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: this.userEmail.trim(),
              spend: this.calcSpend,
              idle: this.calcIdle,
              waste: this.calcResult
            })
          })
          .then(() => {
            // Re-fetch dashboard data to update Overview tab KPIs instantly
            const savedUsuarioId = localStorage.getItem('usuarioId');
            if (savedUsuarioId) {
              this.dashboardService.getDashboardData(Number(savedUsuarioId)).subscribe({
                next: (dashData) => {
                  this.handleDashboardData(dashData);
                },
                error: (err) => console.error('Error recargando dashboard desde calculadora:', err)
              });
            }
          })
          .catch(e => console.error("Error background saving", e));
        }
      } else {
        if (this.userEmail) {
          this.calcTollEmail = this.userEmail;
        }
        this.isCalculatorTollActive = true;
      }
    } else {
      Swal.fire('Campos requeridos', 'Por favor ingresa ambos valores.', 'info');
    }
  }

  revealImpact() {
    if (!this.calcTollEmail || !this.calcTollEmail.includes('@')) {
      Swal.fire('Email inválido', 'Por favor ingresa un correo de trabajo válido.', 'warning');
      return;
    }

    this.isRevealingImpact = true;

    // 1. Pedir acceso (envía el correo de activación si es nuevo)
    fetch(`${environment.apiUrl}/auth/request-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.calcTollEmail.trim() })
    })
    .then(res => res.json())
    .then(authData => {
      // 2. Guardar las métricas de la calculadora vinculadas a ese email
      return fetch(`${environment.apiUrl}/calculadora/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.calcTollEmail.trim(),
          spend: this.calcSpend,
          idle: this.calcIdle,
          waste: this.calcResult
        })
      }).then(() => {
        return authData; // Retornar authData para el siguiente .then
      });
    })
    .then(authData => {
      this.isRevealingImpact = false;
      this.isCalculatorTollActive = false;
      
      if (authData.requiereActivacion) {
        Swal.fire({
          title: '¡Casi listo!',
          text: 'Hemos enviado un enlace de activación a tu correo. Por favor, haz clic en él para ver tus resultados y continuar con el Benchmark.',
          icon: 'success',
          confirmButtonColor: '#22c55e'
        });
      } else {
        // Usuario ya registrado, login inmediato sin esperar enlace
        this.userEmail = authData.email;
        this.isVerified = true;
        localStorage.setItem('userEmail', authData.email);
        localStorage.setItem('isVerified', 'true');
        if (authData.usuarioId) {
          localStorage.setItem('usuarioId', String(authData.usuarioId));
          this.dashboardService.getDashboardData(authData.usuarioId).subscribe({
            next: (dashData) => {
              this.handleDashboardData(dashData);
            },
            error: (err) => console.error('Error cargando datos de usuario existente:', err)
          });
        }
        Swal.fire({
          title: '¡Bienvenido de vuelta!',
          text: 'Hemos iniciado sesión con tu correo: ' + authData.email,
          icon: 'success',
          confirmButtonColor: '#22c55e'
        });
      }
    })
    .catch(err => {
      this.isRevealingImpact = false;
      console.error('Error:', err);
      Swal.fire('Error', 'Hubo un problema de conexión', 'error');
    });
  }

  submitBenchmark() {
    if (!this.benchQ1 || !this.benchQ2 || !this.benchQ3) {
      Swal.fire('Campos incompletos', 'Por favor responde las 3 preguntas.', 'warning');
      return;
    }
    
    // Validar que tengamos un email (ya sea autocompletado del link o de la sesión)
    if (!this.userEmail) {
      Swal.fire('Falta el Email', 'Por favor ingresa tu email en la pantalla inicial primero.', 'warning');
      return;
    }

    this.isBenchmarkLoading = true;

    // Llamada al backend
    fetch(`${environment.apiUrl}/benchmark/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: this.userEmail,
        respuestas: {
          q1: this.benchQ1,
          q2: this.benchQ2,
          q3: this.benchQ3
        }
      })
    })
    .then(res => res.json())
    .then(data => {
      this.isBenchmarkLoading = false;
      if (data.pdfUrl) {
        this.benchmarkPdfUrl = environment.baseUrl + data.pdfUrl;
        
        // Re-fetch dashboard data to update Overview tab with new maturity, score, and position
        const savedUsuarioId = localStorage.getItem('usuarioId');
        if (savedUsuarioId) {
          this.dashboardService.getDashboardData(Number(savedUsuarioId)).subscribe({
            next: (dashData) => {
              this.handleDashboardData(dashData);
            },
            error: (err) => console.error('Error recargando dashboard:', err)
          });
        }

        Swal.fire({
          title: '¡Análisis Completado!',
          text: 'Gemini ha procesado tus datos y generado tu PDF.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          // Si estamos en modal, lo cerramos
          if (this.activeModal === 'benchmark') {
            this.activeModal = 'custom_report';
          } else {
            // Si estamos en dashboard
            this.activeDashboardTab = 'custom_report';
          }
        });
      } else {
        Swal.fire('Error', data.mensaje || 'No se pudo generar el reporte', 'error');
      }
    })
    .catch(err => {
      this.isBenchmarkLoading = false;
      console.error('Error enviando benchmark:', err);
      Swal.fire('Error', 'Hubo un problema de conexión', 'error');
    });
  }

  toggleChat() {
    if (!this.isBackendOnline) {
      return;
    }
    this.isChatOpen = !this.isChatOpen;
    if (!this.isChatOpen) {
      this.chatMessages = [
        { text: 'Hello! I am your AI Infrastructure Assistant. How can I help you today?', isBot: true }
      ];
      this.chatInput = '';
      this.isChatLoading = false;
    }
  }

  sendChatMessage() {
    if (!this.chatInput.trim()) return;
    
    const userMsg = this.chatInput.trim();
    this.chatMessages.push({ text: userMsg, isBot: false });
    this.chatInput = '';
    this.isChatLoading = true;
    
    this.chatService.sendMessage(userMsg).subscribe({
      next: (res) => {
        this.chatMessages.push({ text: res.response, isBot: true });
        this.isChatLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.chatMessages.push({ text: 'Sorry, I am having trouble connecting right now.', isBot: true });
        this.isChatLoading = false;
      }
    });
  }

  comenzarBenchmark() {
    if (this.isSendingAccessEmail) return;

    if (this.userEmail && this.userEmail.trim() !== '') {
      this.procesarEnvioAcceso(this.userEmail.trim());
    } else {
      Swal.fire({
        title: 'Comenzar Gratis',
        text: 'Ingresa tu correo de trabajo para activar tu acceso y comenzar el Benchmark:',
        input: 'email',
        inputValue: '',
        inputPlaceholder: 'nombre@empresa.com',
        showCancelButton: true,
        confirmButtonText: 'Enviar Enlace',
        confirmButtonColor: '#22c55e',
        cancelButtonText: 'Cancelar',
        preConfirm: (email) => {
          if (!email || !email.includes('@')) {
            Swal.showValidationMessage('Por favor, ingresa un correo válido');
          }
          return email;
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          this.procesarEnvioAcceso(result.value.trim());
        }
      });
    }
  }

  procesarEnvioAcceso(targetEmail: string) {
    // Mostrar alerta de cargando
    Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espera un momento.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading(null);
      }
    });

    this.isSendingAccessEmail = true;

    fetch(`${environment.apiUrl}/auth/request-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail })
    })
    .then(res => res.json())
    .then(authData => {
      this.isSendingAccessEmail = false;
      console.log('Respuesta de acceso:', authData);
      if (authData.requiereActivacion) {
        Swal.fire({
          title: '¡Casi listo!',
          text: 'Hemos enviado un enlace de activación a ' + targetEmail + '. Por favor, haz clic en él para acceder a tu panel.',
          icon: 'success',
          confirmButtonColor: '#22c55e'
        });
        this.userEmail = ''; // Limpiar
      } else {
        // Login directo
        this.userEmail = authData.email;
        this.isVerified = true;
        localStorage.setItem('userEmail', authData.email);
        localStorage.setItem('isVerified', 'true');
        if (authData.usuarioId) {
          localStorage.setItem('usuarioId', String(authData.usuarioId));
          this.dashboardService.getDashboardData(authData.usuarioId).subscribe({
            next: (dashData) => {
              this.handleDashboardData(dashData);
            },
            error: (err) => console.error('Error cargando datos de usuario existente:', err)
          });
        }
        Swal.fire({
          title: '¡Bienvenido de vuelta!',
          text: 'Hemos iniciado sesión con tu correo: ' + targetEmail,
          icon: 'success',
          confirmButtonColor: '#22c55e'
        });
      }
    })
    .catch(error => {
      this.isSendingAccessEmail = false;
      console.error('Error solicitando acceso:', error);
      Swal.fire({
        title: '¡Ups!',
        text: 'Tuvimos un problema conectando con el servidor. Por favor, intenta de nuevo.',
        icon: 'error',
        confirmButtonColor: '#e74c3c'
      });
    });
  }

  logout() {
    this.userEmail = '';
    this.isVerified = false;
    this.isAdmin = false;
    this.dashboardData = null;
    this.benchmarkPdfUrl = null;
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isVerified');
    localStorage.removeItem('usuarioId');
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    Swal.fire({
      title: 'Sesión Cerrada',
      text: 'Has salido y se han limpiado tus datos.',
      icon: 'success',
      confirmButtonColor: '#22c55e',
      timer: 1500,
      showConfirmButton: false
    });
  }

  toggleZoom() {
    this.zoomActivo = !this.zoomActivo;
    if (this.zoomActivo) {
      this.iniciarLupa();
    } else {
      this.detenerLupa();
    }
  }

  private iniciarLupa() {
    const mainContent = document.getElementById('app-main-content');
    if (!mainContent) return;

    this.lensElement = document.createElement('div');
    this.lensElement.id = 'lupa-lens-container';
    this.lensElement.style.position = 'fixed';
    this.lensElement.style.border = '4px solid #22c55e'; // Green matching AI theme
    this.lensElement.style.borderRadius = '50%';
    this.lensElement.style.width = this.lensSize + 'px';
    this.lensElement.style.height = this.lensSize + 'px';
    this.lensElement.style.pointerEvents = 'none';
    this.lensElement.style.overflow = 'hidden';
    this.lensElement.style.zIndex = '9999';
    this.lensElement.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.5), 0 10px 25px rgba(0,0,0,0.5)';
    this.lensElement.style.backgroundColor = '#0a0f0c'; // Dark theme match

    this.refreshLupa(true);
    document.body.appendChild(this.lensElement);
    
    this.mouseMoveListener = this.onMouseMove.bind(this);
    document.addEventListener('mousemove', this.mouseMoveListener);

    setTimeout(() => {
      this.clickCloseListener = () => {
        this.zoomActivo = false;
        this.detenerLupa();
      };
      document.addEventListener('click', this.clickCloseListener);
    }, 50);
  }

  private refreshLupa(initial: boolean = false) {
    if (!this.zoomActivo || !this.lensElement) return;
    const mainContent = document.getElementById('app-main-content');
    if (!mainContent) return;

    const newClone = mainContent.cloneNode(true) as HTMLElement;
    newClone.style.position = 'absolute';
    newClone.style.width = mainContent.offsetWidth + 'px';
    newClone.style.height = mainContent.offsetHeight + 'px';
    newClone.style.transformOrigin = '0 0';
    newClone.style.pointerEvents = 'none';

    const originalScrollables = mainContent.querySelectorAll('*');
    const clonedScrollables = newClone.querySelectorAll('*');
    for (let i = 0; i < originalScrollables.length; i++) {
        if (originalScrollables[i].scrollTop > 0 || originalScrollables[i].scrollLeft > 0) {
            clonedScrollables[i].scrollTop = originalScrollables[i].scrollTop;
            clonedScrollables[i].scrollLeft = originalScrollables[i].scrollLeft;
        }
    }
    
    const allClonedElements = newClone.querySelectorAll('*');
    allClonedElements.forEach(el => el.removeAttribute('id'));

    if (initial) {
      this.clonedContent = newClone;
      this.lensElement.appendChild(this.clonedContent);
    } else {
      if (this.clonedContent && this.clonedContent.parentNode) {
        newClone.style.transform = this.clonedContent.style.transform;
        this.lensElement.replaceChild(newClone, this.clonedContent);
        this.clonedContent = newClone;
      }
    }
  }

  private detenerLupa() {
    if (this.lensElement && this.lensElement.parentNode) {
      this.lensElement.parentNode.removeChild(this.lensElement);
    }
    this.lensElement = null;
    this.clonedContent = null;
    
    if (this.mouseMoveListener) {
      document.removeEventListener('mousemove', this.mouseMoveListener);
      this.mouseMoveListener = null;
    }
    
    if (this.clickCloseListener) {
      document.removeEventListener('click', this.clickCloseListener);
      this.clickCloseListener = null;
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.zoomActivo || !this.lensElement || !this.clonedContent) return;

    const mainContent = document.getElementById('app-main-content');
    if (mainContent) {
      const selectors = '.overflow-y-scroll, .overflow-y-auto, .overflow-auto';
      const origScrollables = mainContent.querySelectorAll(selectors);
      const cloneScrollables = this.clonedContent.querySelectorAll(selectors);
      for (let i = 0; i < origScrollables.length; i++) {
        if (cloneScrollables[i]) {
          cloneScrollables[i].scrollTop = origScrollables[i].scrollTop;
          cloneScrollables[i].scrollLeft = origScrollables[i].scrollLeft;
        }
      }
    }

    const x = e.clientX;
    const y = e.clientY;
    const halfLens = this.lensSize / 2;

    this.lensElement.style.left = (x - halfLens) + 'px';
    this.lensElement.style.top = (y - halfLens) + 'px';

    const rx = -(x + window.scrollX) * this.zoomScale + halfLens;
    const ry = -(y + window.scrollY) * this.zoomScale + halfLens;

    this.clonedContent.style.transform = `translate(${rx}px, ${ry}px) scale(${this.zoomScale})`;
  }

  // --- Lógica de Outreach (Admin) ---
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.outreachFile = file;
    }
  }

  uploadCsv() {
    if (!this.outreachFile || !this.outreachCampanaNombre.trim()) {
      Swal.fire('Atención', 'Debes ingresar un nombre de campaña y seleccionar un archivo CSV.', 'warning');
      return;
    }

    this.isUploadingCsv = true;
    
    // Note: We use the fetch API or HttpClient manually since we are using FormData
    const formData = new FormData();
    formData.append('file', this.outreachFile);
    formData.append('nombreCampana', this.outreachCampanaNombre.trim());

    fetch(`${environment.apiUrl}/outreach/upload`, {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      this.isUploadingCsv = false;
      if (data.campanaId) {
        Swal.fire('¡Éxito!', 'Campaña procesada y correos enviados. Id de campaña: ' + data.campanaId, 'success');
        this.outreachFile = null;
        this.outreachCampanaNombre = '';
      } else {
        Swal.fire('Error', data.mensaje || 'Hubo un error al procesar la campaña', 'error');
      }
    })
    .catch(error => {
      this.isUploadingCsv = false;
      console.error('Error uploading CSV:', error);
      Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
    });
  }

  loadAdminLeads() {
    fetch(`${environment.apiUrl}/outreach/leads`)
      .then(res => res.json())
      .then(data => {
        this.adminLeads = data;
      })
      .catch(err => {
        console.error('Error loading leads:', err);
      });
  }

  ngOnDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  checkBackendHealth() {
    fetch(`${environment.apiUrl}/health`)
      .then(res => {
        this.isBackendOnline = res.ok;
        if (!this.isBackendOnline) {
          this.isChatOpen = false;
        }
      })
      .catch(() => {
        this.isBackendOnline = false;
        this.isChatOpen = false;
      });
  }

  handleDashboardData(dashData: any) {
    this.dashboardData = dashData;
    if (dashData && dashData.pdfUrl) {
      this.benchmarkPdfUrl = environment.baseUrl + dashData.pdfUrl;
    } else {
      this.benchmarkPdfUrl = null;
    }
  }
}
