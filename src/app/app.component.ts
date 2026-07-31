import { Component } from '@angular/core';
import { UsuarioService } from './usuario.service';
import { ChatService } from './chat.service';
import { DashboardService } from './dashboard.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'ai-infrastructure-frontend';
  userEmail: string = '';
  dashboardData: any = null; // Para guardar la data del backend
  activeModal: string | null = null;
  activeDashboardTab: string = 'overview';
  
  // Variables de la calculadora
  calcSpend: number | null = null;
  calcIdle: number | null = null;
  calcResult: number | null = null;

  // Chat Variables
  isChatOpen: boolean = false;
  chatInput: string = '';
  chatMessages: {text: string, isBot: boolean}[] = [
    { text: 'Hello! I am your AI Infrastructure Assistant. How can I help you today?', isBot: true }
  ];
  isChatLoading: boolean = false;

  constructor(
    private usuarioService: UsuarioService,
    private chatService: ChatService,
    private dashboardService: DashboardService
  ) {}

  openModal(modalName: string, event: Event) {
    event.preventDefault();
    this.activeModal = modalName;
  }

  closeModal() {
    this.activeModal = null;
  }

  setDashboardTab(tabName: string) {
    this.activeDashboardTab = tabName;
  }

  calculateImpact() {
    if (this.calcSpend != null && this.calcIdle != null) {
      this.calcResult = (this.calcSpend * this.calcIdle) / 100;
    }
  }

  toggleChat() {
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
    if (this.userEmail && this.userEmail.trim() !== '') {
      this.usuarioService.registrarUsuario(this.userEmail).subscribe({
        next: (response: any) => {
          console.log('Usuario registrado:', response);
          
          // El backend nos devuelve el usuarioId, así que pedimos sus métricas
          const id = response.usuarioId;
          if (id) {
            this.dashboardService.getDashboardData(id).subscribe({
              next: (dashData) => {
                this.dashboardData = dashData;
                Swal.fire({
                  title: '¡Excelente!',
                  text: 'Tu análisis está listo. Revisa tu panel actualizado.',
                  icon: 'success',
                  confirmButtonColor: '#3498db'
                });
              },
              error: (err) => {
                console.error('Error al cargar dashboard', err);
              }
            });
          }
          
          this.userEmail = ''; // Limpiamos el campo
        },
        error: (error) => {
          console.error('Error al registrar usuario', error);
          Swal.fire({
            title: '¡Ups!',
            text: 'Tuvimos un problema conectando con el servidor. Por favor, intenta de nuevo.',
            icon: 'error',
            confirmButtonColor: '#e74c3c'
          });
        }
      });
    } else {
      Swal.fire({
        title: 'Email requerido',
        text: 'Por favor, ingresa tu email de trabajo para comenzar.',
        icon: 'warning',
        confirmButtonColor: '#f39c12'
      });
    }
  }
}
