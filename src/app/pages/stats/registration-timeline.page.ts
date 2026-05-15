import { Component } from '@angular/core';
import { DomainGanttChartComponent } from '~/app/components/charts/registration-lifespan/registration-lifespan.component';

@Component({
  standalone: true,
  selector: 'app-stats-registration-timeline-page',
  template:
    '<h1>Registration Timeline</h1><app-domain-gantt-chart [groupDates]="true" />',
  imports: [DomainGanttChartComponent],
})
export default class RegistrationTimelinePage {}
