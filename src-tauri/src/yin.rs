pub fn yin_pitch_detection(buffer: &[f32], sample_rate: f32) -> Option<f32> {
    let threshold = 0.1;
    let min_tau = 2;
    let max_tau = buffer.len() / 2;
    if max_tau < min_tau + 2 { return None; }
    let mut yin_buffer = vec![0.0f32; max_tau];

    // Step 1: Difference function
    for tau in min_tau..max_tau {
        let mut sum = 0.0;
        for i in 0..max_tau {
            let delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
        }
        yin_buffer[tau] = sum;
    }

    // Step 2: Cumulative mean normalized difference
    let mut running_sum = 0.0;
    yin_buffer[0] = 1.0;
    for tau in 1..max_tau {
        running_sum += yin_buffer[tau];
        yin_buffer[tau] *= tau as f32 / running_sum.max(1e-8);
    }

    // Step 3: Absolute threshold
    let mut tau_estimate = None;
    for tau in min_tau..max_tau {
        if yin_buffer[tau] < threshold {
            let mut t = tau;
            while t + 1 < max_tau && yin_buffer[t + 1] < yin_buffer[t] {
                t += 1;
            }
            tau_estimate = Some(t);
            break;
        }
    }
    let tau_estimate = tau_estimate?;
    // Step 4: Parabolic interpolation
    let better_tau = parabolic_interpolation(&yin_buffer, tau_estimate);
    Some(sample_rate / better_tau)
}

fn parabolic_interpolation(buffer: &[f32], tau: usize) -> f32 {
    if tau < 1 || tau + 1 >= buffer.len() {
        return tau as f32;
    }
    let s0 = buffer[tau - 1];
    let s1 = buffer[tau];
    let s2 = buffer[tau + 1];
    let a = (s0 + s2 - 2.0 * s1) / 2.0;
    let b = (s2 - s0) / 2.0;
    if a.abs() < 1e-8 {
        tau as f32
    } else {
        tau as f32 - b / (2.0 * a)
    }
}
