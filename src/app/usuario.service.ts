import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  // Ajustaremos esta URL si el backend corre en otro lugar
  private apiUrl = 'http://localhost:8080/api/usuarios';

  constructor(private http: HttpClient) { }

  registrarUsuario(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/registrar`, { email });
  }
}
